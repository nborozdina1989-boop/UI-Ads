import "./globals.css";

export const metadata = {
  title: "AdRiver прототип",
  description: "Лёгкий прототип без бэка: кампании, медиаплан, генерация, конструктор и дашборд",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
