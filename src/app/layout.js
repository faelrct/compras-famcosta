import './globals.css';

export const metadata = {
  title: 'Lista de Compras',
  description: 'Aplicativo de lista de compras',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}