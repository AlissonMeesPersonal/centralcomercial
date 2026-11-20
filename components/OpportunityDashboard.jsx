"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Download, Link2, RefreshCcw, Trash2, FileText, Upload } from "lucide-react";
import OpportunityImporter from "./OpportunityImporter";
import MultifilialImporter from "./MultifilialImporter";

const fmt = (n) => Number(n || 0).toLocaleString("pt-BR");
const pct = (x, y) => (y ? ((100 * x) / y).toFixed(1).replace(".", ",") + "%" : "0,0%");
function printable(report) {
  const entries = [...(report?.daily || [])].sort((a, b) => a.day - b.day);
  const [year, month] = String(report.period).split("-").map(Number);
  const sum = entries.reduce(
    (acc, r) => ({
      opportunities: acc.opportunities + Number(r.opportunities || 0),
      sales: acc.sales + Number(r.sales || 0),
    }),
    { opportunities: 0, sales: 0 },
  );
  const elapsed = Math.max(1, ...entries.map((x) => Number(x.day) || 1));
  const days = new Date(year, month, 0).getDate();
  // Tendência projetada pela média diária até o último dia com dados.
  const tendency = Math.round((sum.sales / elapsed) * days);
  return {
    entries,
    sum,
    elapsed,
    days,
    tendency,
    monthName: new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    }),
  };
}
export default function OpportunityDashboard() {
  const [data, setData] = useState({ reports: [], links: [], multifilialReports: [] }),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [newLabel, setNewLabel] = useState("Assistente da Andressa");
  const [generated, setGenerated] = useState(""),
    [period, setPeriod] = useState(""),
    [type, setType] = useState("multifilial");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/opportunity-reports", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Erro ao consultar relatórios.");
      setData(result);
      setPeriod(
        (p) => p || result.reports?.[0]?.period || result.multifilialReports?.[0]?.period || "",
      );
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15000);
    return () => clearInterval(timer);
  }, [load]);
  async function action(action, values = {}) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/opportunity-reports", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...values }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Não foi possível concluir.");
      if (action === "create_link") setGenerated(result.url);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const report = data.reports.find((x) => x.period === period) || data.reports[0];
  const info = useMemo(() => (report ? printable(report) : null), [report]);
  const multiReports = data.multifilialReports || [];
  const multi = multiReports.find((x) => x.period === period) || multiReports[0];
  const money = (n) =>
    Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return (
    <div className="cc-op-module">
      <div className="heading-row">
        <div>
          <div className="eyebrow">COMERCIAL • IMPORTAÇÃO EM LOTE</div>
          <h1>Levantamento comercial</h1>
          <p>
            Importe a planilha original da rede para gerar um PDF consolidado de vendas, sem
            cadastrar unidade por unidade.
          </p>
        </div>
        <button className="btn secondary" onClick={load}>
          <RefreshCcw size={15} /> Atualizar
        </button>
      </div>
      <div className="toolbar">
        <div className="tab-list">
          <button
            className={type === "multifilial" ? "active" : ""}
            onClick={() => setType("multifilial")}
          >
            Vendas Multifiliais · Excel original
          </button>
          <button className={type === "daily" ? "active" : ""} onClick={() => setType("daily")}>
            Conversão diária (requer oportunidades)
          </button>
        </div>
      </div>
      <div className="cc-op-grid">
        <section className="panel">
          <div className="section-title">
            <div>
              <h3>
                <Upload size={17} /> Importar levantamento
              </h3>
              <p>Disponível para administração</p>
            </div>
          </div>
          {type === "multifilial" ? (
            <>
              <MultifilialImporter onImported={load} />
              <p className="cc-op-note">
                O Excel informa vendas acumuladas por unidade. Ao importar, o sistema soma toda a
                rede e gera um PDF com os totais reais, sem inventar conversões diárias. Para
                converter por dia, é necessária outra exportação que traga oportunidades e datas.
              </p>
            </>
          ) : (
            <OpportunityImporter onImported={load} />
          )}
        </section>
        <section className="panel">
          <div className="section-title">
            <div>
              <h3>
                <Link2 size={17} /> Link exclusivo de envio
              </h3>
              <p>A assistente não precisa acessar as outras áreas da plataforma.</p>
            </div>
          </div>
          <label className="field">
            <span>Identificação da pessoa autorizada</span>
            <input value={newLabel} maxLength={100} onChange={(e) => setNewLabel(e.target.value)} />
          </label>
          <p className="cc-op-note">
            Link individual com validade de 30 dias. Qualquer pessoa que possuir o link poderá
            enviar levantamentos; compartilhe somente com a assistente e revogue caso necessário.
          </p>
          <button
            className="btn"
            disabled={busy || newLabel.trim().length < 3}
            onClick={() => action("create_link", { label: newLabel.trim() })}
          >
            Gerar link de importação
          </button>
          {generated && (
            <div className="cc-op-created">
              <input readOnly aria-label="Link gerado" value={generated} />
              <button
                type="button"
                className="btn secondary"
                onClick={() => navigator.clipboard.writeText(generated)}
              >
                <Copy size={15} /> Copiar
              </button>
            </div>
          )}
          <div className="cc-op-links">
            {(data.links || []).map((x) => (
              <div key={x.id} className="cc-op-link-row">
                <div>
                  <strong>{x.label}</strong>
                  <small>
                    {x.upload_count} envios · validade{" "}
                    {new Date(x.expires_at).toLocaleDateString("pt-BR")}
                    {x.revoked_at ? " · Revogado" : ""}
                  </small>
                </div>
                {!x.revoked_at && (
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("Revogar este link?"))
                        void action("revoke_link", { id: x.id });
                    }}
                  >
                    <Trash2 size={14} /> Revogar
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
      {type === "multifilial" && (
        <section className="panel cc-op-report-card">
          <div className="section-title">
            <div>
              <h3>
                <FileText size={18} /> PDF consolidado de vendas da rede
              </h3>
              <p>
                Geração automática com os dados reais da planilha Vendas Multifiliais, sem separar
                unidades.
              </p>
            </div>
            <div className="cc-op-report-actions">
              <select
                aria-label="Mês do relatório de vendas"
                value={multi?.period || ""}
                onChange={(e) => setPeriod(e.target.value)}
              >
                {multiReports.map((r) => (
                  <option key={r.period} value={r.period}>
                    {r.period.slice(5) + "/" + r.period.slice(0, 4)}
                  </option>
                ))}
              </select>
              <button className="btn secondary" disabled={!multi} onClick={() => window.print()}>
                <Download size={15} /> Gerar PDF
              </button>
            </div>
          </div>
          {!multi ? (
            <div className="empty">
              Selecione a planilha Vendas Multifiliais (.xlsx) acima, escolha o mês e confirme a
              importação para liberar o PDF.
            </div>
          ) : (
            <div id="cc-op-print" className="cc-op-print">
              <div className="cc-op-print-heading">
                <span className="cc-op-logo">
                  <strong>26</strong>
                  <em>fit</em>
                </span>
                <span>academia eficiente</span>
              </div>
              <h2>
                VENDAS CONSOLIDADAS DA REDE —{" "}
                {multi.period.slice(5) + "/" + multi.period.slice(0, 4)}
              </h2>
              <p className="cc-op-network-label">
                TODAS AS {multi.rows?.length || 0} UNIDADES · CONSOLIDADO MENSAL
              </p>
              <div className="cc-op-summary">
                <div>
                  <small>VENDAS NOVAS</small>
                  <strong>{fmt(multi.totals.newSales)}</strong>
                </div>
                <div>
                  <small>RENOVAÇÕES</small>
                  <strong>{fmt(multi.totals.renewals)}</strong>
                </div>
                <div>
                  <small>VENDAS TOTAIS</small>
                  <strong>{fmt(multi.totals.totalSales)}</strong>
                </div>
                <div>
                  <small>CRESCIMENTO LÍQUIDO</small>
                  <strong>{fmt(multi.totals.growth)}</strong>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>INDICADOR</th>
                    <th>QUANTIDADE</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Vendas novas</td>
                    <td>{fmt(multi.totals.newSales)}</td>
                  </tr>
                  <tr>
                    <td>Renovações</td>
                    <td>{fmt(multi.totals.renewals)}</td>
                  </tr>
                  <tr>
                    <td>Total de vendas</td>
                    <td>{fmt(multi.totals.totalSales)}</td>
                  </tr>
                  <tr>
                    <td>Cancelamentos</td>
                    <td>{fmt(multi.totals.cancellations)}</td>
                  </tr>
                  <tr>
                    <td>Não renovados</td>
                    <td>{fmt(multi.totals.nonRenewals)}</td>
                  </tr>
                  <tr>
                    <td>Evasões totais</td>
                    <td>{fmt(multi.totals.totalLosses)}</td>
                  </tr>
                  <tr>
                    <td>Crescimento líquido</td>
                    <td>{fmt(multi.totals.growth)}</td>
                  </tr>
                  <tr>
                    <td>Receita total de vendas</td>
                    <td>{money(multi.totals.totalRevenue)}</td>
                  </tr>
                  <tr>
                    <td>Receita de evasões</td>
                    <td>{money(multi.totals.totalLossRevenue)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="cc-op-note">
                <strong>Observação:</strong> esta exportação não contém oportunidades nem datas
                diárias. Portanto, conversão diária, acumulado de oportunidades e tendência diária
                não são calculados neste PDF.
              </p>
              <p className="cc-op-note">
                Fonte: {multi.filename} · Atualizado em{" "}
                {new Date(multi.imported_at).toLocaleString("pt-BR")} · Consolidado de{" "}
                {multi.rows?.length || 0} unidades.
              </p>
            </div>
          )}
        </section>
      )}
      {type === "daily" && (
        <section className="panel cc-op-report-card">
          <div className="section-title">
            <div>
              <h3>
                <FileText size={18} /> Relatório de conversão
              </h3>
              <p>Um relatório único para todas as filiais, organizado por dia.</p>
            </div>
            <div className="cc-op-report-actions">
              <select
                aria-label="Selecionar mês"
                value={report?.period || ""}
                onChange={(e) => setPeriod(e.target.value)}
              >
                {(data.reports || []).map((r) => (
                  <option key={r.period} value={r.period}>
                    {r.period.slice(5) + "/" + r.period.slice(0, 4)}
                  </option>
                ))}
              </select>
              <button className="btn secondary" disabled={!report} onClick={() => window.print()}>
                <Download size={15} /> Salvar em PDF
              </button>
            </div>
          </div>
          {!report ? (
            <div className="empty">
              Ainda não há oportunidades e vendas por dia. A planilha Vendas Multifiliais, sozinha,
              não fornece esses campos.
            </div>
          ) : (
            <div id="cc-op-print" className="cc-op-print">
              <div className="cc-op-print-heading">
                <span className="cc-op-logo">
                  <strong>26</strong>
                  <em>fit</em>
                </span>
                <span>academia eficiente</span>
              </div>
              <h2>LEVANTAMENTO COMERCIAL — {info.monthName.toLocaleUpperCase("pt-BR")}</h2>
              <p className="cc-op-network-label">RESULTADO CONSOLIDADO DE TODAS AS UNIDADES</p>
              <div className="cc-op-summary">
                <div>
                  <small>OPORTUNIDADES</small>
                  <strong>{fmt(info.sum.opportunities)}</strong>
                </div>
                <div>
                  <small>VENDAS REALIZADAS</small>
                  <strong>{fmt(info.sum.sales)}</strong>
                </div>
                <div>
                  <small>TENDÊNCIA DO MÊS</small>
                  <strong>{fmt(info.tendency)}</strong>
                </div>
                <div>
                  <small>CONVERSÃO ACUMULADA</small>
                  <strong>{pct(info.sum.sales, info.sum.opportunities)}</strong>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>DATA</th>
                    <th>OPORTUNIDADES</th>
                    <th>VENDAS REALIZADAS</th>
                    <th>CONVERSÃO</th>
                  </tr>
                </thead>
                <tbody>
                  {info.entries.map((r) => (
                    <tr key={r.day}>
                      <td>
                        {String(r.day).padStart(2, "0")}/
                        {String(Number(report.period.slice(5))).padStart(2, "0")}
                      </td>
                      <td>{fmt(r.opportunities)}</td>
                      <td>{fmt(r.sales)}</td>
                      <td>{pct(r.sales, r.opportunities)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="cc-op-note">
                Conversão: vendas realizadas ÷ oportunidades × 100. Tendência: vendas acumuladas ÷
                último dia registrado × quantidade de dias do mês. Estimativa, não meta garantida.
              </p>
              <p className="cc-op-note">
                Fonte: {report.filename} · Atualizado em{" "}
                {new Date(report.imported_at).toLocaleString("pt-BR")}
              </p>
            </div>
          )}
        </section>
      )}
      {error && (
        <p className="validation" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
