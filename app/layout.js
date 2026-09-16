import './globals.css';

export const metadata = {
  title: 'Bid Compliance Verification — CPCL',
  description: 'AI-powered integrated bid compliance verification for GeM procurement',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans text-slate-900 antialiased">{children}</body>
    </html>
  );
}
