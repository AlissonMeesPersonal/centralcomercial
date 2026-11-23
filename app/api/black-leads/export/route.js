import { getAccess } from "../../../../lib/access";
import { database } from "../../../../lib/db";
import { CAMPAIGN, canManageLeads } from "../../../../lib/black-leads";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const fmt = (v) =>
  v ? new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
const digits = (value) => String(value || "").replace(/\D/g, "");
export async function GET(request) {
  const access = await getAccess();
  if (!canManageLeads(access))
    return Response.json({ error: "Acesso restrito à gestão comercial." }, { status: 403 });
  const url = new URL(request.url),
    unit = String(url.searchParams.get("unit") || "").trim();
  if (!unit || unit.length > 180)
    return Response.json({ error: "Selecione uma unidade para exportar." }, { status: 422 });
  const sql = database();
  const rows = await sql.query(
    "SELECT lead_name,phone,email,unit_label,status,notes,response_at,contacted_at,converted_at,extra_fields FROM cc_black_leads WHERE campaign=$1 AND import_quarantined=false AND unit_label=$2 ORDER BY response_at ASC NULLS LAST, imported_at ASC LIMIT 30000",
    [CAMPAIGN, unit],
  );
  if (!rows.length)
    return Response.json({ error: "Esta unidade ainda não possui leads." }, { status: 404 });
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "26fit Central Comercial";
  workbook.created = new Date();
  workbook.modified = new Date();
  // Cada coluna recebida do formulário será preservada no Excel da unidade.
  const originalHeaders = [...new Set(rows.flatMap((lead) =>
    lead.extra_fields && typeof lead.extra_fields === "object" && !Array.isArray(lead.extra_fields)
      ? Object.keys(lead.extra_fields)
      : [],
  ))].slice(0, 150);
  const safeCell = (value) => {
    const result = String(value ?? "").slice(0, 2000);
    // Evita execução de fórmulas ao abrir células originadas de respostas externas.
    return /^\s*[=+@-]/.test(result) ? "'" + result : result;
  };
  const excelColumn = (n) => {
    let name = "";
    for (let x = n; x > 0; x = Math.floor((x - 1) / 26))
      name = String.fromCharCode(65 + (x - 1) % 26) + name;
    return name;
  };
  const totalColumns = 10 + originalHeaders.length;
  const lastColumn = excelColumn(totalColumns);
  const sheet = workbook.addWorksheet("Leads Black Friday", {
    views: [{ state: "frozen", ySplit: 4 }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  sheet.mergeCells("A1:" + lastColumn + "1");
  sheet.getCell("A1").value = "26fit  |  BLACK FRIDAY 2026";
  sheet.getCell("A1").font = { size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF171B1E" } };
  sheet.getRow(1).height = 38;
  sheet.mergeCells("A2:" + lastColumn + "2");
  sheet.getCell("A2").value =
    "Carteira da unidade: " + unit + " • Uso restrito ao atendimento dos leads da campanha";
  sheet.getCell("A2").font = { size: 11, color: { argb: "FF525C65" }, bold: true };
  sheet.getRow(2).height = 26;
  const headers = [
    "DATA DO CADASTRO",
    "NOME",
    "WHATSAPP",
    "E-MAIL",
    "UNIDADE",
    "SITUAÇÃO",
    "CONTATADO EM",
    "CONVERTIDO EM",
    "OBSERVAÇÕES",
    "ABRIR WHATSAPP",
    ...originalHeaders.map((header) => "ORIGINAL • " + header),
  ];
  sheet.getRow(4).values = headers;
  sheet.getRow(4).height = 28;
  sheet.getRow(4).eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF762F" } };
    c.font = { bold: true, color: { argb: "FF171B1E" }, size: 10 };
    c.alignment = { vertical: "middle", wrapText: true };
  });
  const widths = [23, 33, 22, 33, 32, 19, 23, 23, 45, 23];
  widths.forEach((width, i) => (sheet.getColumn(i + 1).width = width));
  originalHeaders.forEach((_, i) => (sheet.getColumn(i + 11).width = 30));
  rows.forEach((lead, index) => {
    const number = digits(lead.phone);
    const full =
      number.startsWith("55") && (number.length === 12 || number.length === 13)
        ? number
        : "55" + number;
    const row = sheet.getRow(index + 5);
    row.values = [
      fmt(lead.response_at),
      safeCell(lead.lead_name),
      safeCell(lead.phone),
      safeCell(lead.email),
      safeCell(lead.unit_label),
      lead.status.replaceAll("_", " "),
      fmt(lead.contacted_at),
      fmt(lead.converted_at),
      safeCell(lead.notes),
      "Abrir conversa",
      ...originalHeaders.map((header) => safeCell(lead.extra_fields?.[header])),
    ];
    row.height = 22;
    row.eachCell((c) => {
      c.alignment = { vertical: "middle", wrapText: false };
      c.font = { size: 10, color: { argb: "FF2C353B" } };
      if (index % 2 === 1)
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F7F9" } };
    });
    row.getCell(3).numFmt = "@";
    originalHeaders.forEach((_, i) => (row.getCell(i + 11).numFmt = "@"));
    row.getCell(10).value = { text: "Conversar", hyperlink: "https://wa.me/" + full };
    row.getCell(10).font = { color: { argb: "FF175CD3" }, underline: true };
  });
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: rows.length + 4, column: totalColumns } };
  sheet.printTitlesRow = "1:4";
  sheet.headerFooter.oddFooter =
    "26fit Central Comercial • Contatos restritos para campanha Black Friday 2026 | Página &P de &N";
  const summary = workbook.addWorksheet("Indicadores");
  summary.columns = [{ width: 35 }, { width: 20 }];
  summary.mergeCells("A1:B1");
  summary.getCell("A1").value = "BLACK FRIDAY 26fit • " + unit;
  summary.getCell("A1").font = { bold: true, size: 14, color: { argb: "FFFF762F" } };
  const count = (status) => rows.filter((r) => r.status === status).length;
  const contacted = rows.filter((r) => r.status !== "novo").length,
    converted = count("convertido");
  const metrics = [
    ["Leads gerados", rows.length],
    ["Em contato", count("em_contato")],
    ["Interessados", count("interessado")],
    ["Sem retorno", count("sem_retorno")],
    ["Convertidos", converted],
    ["Contatados", contacted],
    ["Conversão da carteira", rows.length ? converted / rows.length : 0],
  ];
  metrics.forEach((m, i) => {
    const row = summary.getRow(i + 3);
    row.values = m;
    row.getCell(1).font = { bold: true };
    if (i === 6) row.getCell(2).numFmt = "0.0%";
  });
  summary.getCell("A12").value =
    "Uso interno • Contate apenas pessoas que autorizaram comunicação comercial.";
  summary.getCell("A12").font = { italic: true, size: 10, color: { argb: "FF64717C" } };
  const buffer = await workbook.xlsx.writeBuffer();
  const file =
    "leads-black-friday-" +
    unit
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 60) +
    ".xlsx";
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="' + file + '"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie",
    },
  });
}
