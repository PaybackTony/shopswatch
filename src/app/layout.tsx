import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Shop by Color — Find Dresses by Color",
  description:
    "Search dresses across retailers by the exact color you envision, sorted by perceptual color distance.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
