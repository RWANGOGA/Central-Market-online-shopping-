import type { ReactNode } from 'react';

export const metadata = {
  title: 'Grocery API',
  description: 'Backend for the Interactive Grocery Mobile App',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          padding: '2rem',
          lineHeight: 1.6,
        }}
      >
        {children}
      </body>
    </html>
  );
}