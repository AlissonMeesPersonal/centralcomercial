import "./globals.css";
export const metadata = {
 title: "26fit • Central Comercial",
 description: "Planejamento e execução comercial da rede 26fit",
 robots: { index: false, follow: false },
};
export default function RootLayout({children}) {
 return <html lang="pt-BR"><body>{children}</body></html>;
}