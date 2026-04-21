import './globals.css';

export const metadata = {
  title: 'TwinMind Copilot',
  description: 'Live AI Meeting Suggestions',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}