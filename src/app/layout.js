export const metadata = {
  title: 'Lista de Compras - FamCosta',
  description: 'Lista de compras compartilhada',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#111116] text-white">
        {children}
      </body>
    </html>
  );
}