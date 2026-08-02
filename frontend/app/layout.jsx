import "./theme.css";
import "./globals.css";

export const metadata = {
  title: "Booking Dashboard",
  description: "Role based booking workflow dashboard",
  icons: {
    icon: "/favicon-v4.png",
    apple: "/apple-touch-icon-v4.png"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon-v4.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon-v4.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
