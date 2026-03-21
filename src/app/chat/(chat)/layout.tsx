import type { Metadata } from "next";

import React from "react";

interface ChatLayoutProps {
  children: React.ReactNode;
}

export const metadata: Metadata = {
  title: "Chat | RAG Starter Kit",
  description: "Chat with your documents using AI-powered RAG",
};

export default function ChatLayout({ children }: ChatLayoutProps): React.ReactElement {
  return (
    <div className="h-screen overflow-hidden">
      {children}
    </div>
  );
}
