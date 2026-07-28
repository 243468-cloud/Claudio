"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Menu, Plus, User, Sparkles, Loader2, Bot } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "model";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/chat";
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al conectar con la API");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "model",
          content: data.message,
        },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "model",
          content: `Error: ${error.message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex h-screen bg-[#fdfaf6] dark:bg-[#1a1a1a] text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden transition-colors duration-500">
      {/* Sidebar */}
      <div 
        className={`${
          isSidebarOpen ? "w-72 translate-x-0" : "w-0 -translate-x-full"
        } transition-all duration-300 ease-in-out bg-[#fdfaf6] dark:bg-[#1a1a1a] flex flex-col border-r border-zinc-200 dark:border-zinc-800 absolute md:relative z-20 h-full overflow-hidden shrink-0 shadow-xl shadow-black/5 md:shadow-none`}
      >
        <div className="p-4 flex items-center h-16 shrink-0">
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors md:hidden text-zinc-500 dark:text-zinc-400"
          >
            <Menu size={24} />
          </button>
        </div>
        
        <div className="px-4 pb-4">
          <button 
            onClick={() => setMessages([])}
            className="flex items-center gap-3 w-full p-3 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-white rounded-xl transition-colors text-sm font-medium shadow-sm"
          >
            <Plus size={20} />
            Nuevo chat
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <div className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 mb-3 px-2 uppercase tracking-widest">
            Recientes
          </div>
          <button className="flex items-center gap-3 w-full p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 rounded-xl transition-colors text-sm text-zinc-600 dark:text-zinc-400 text-left truncate">
            <span className="truncate">¿Cómo funciona Claudio?</span>
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative h-full max-w-full overflow-hidden bg-white dark:bg-[#1e1e1e]">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 sticky top-0 bg-white/80 dark:bg-[#1e1e1e]/80 backdrop-blur-md z-10 border-b border-zinc-100 dark:border-zinc-800/50">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 dark:text-zinc-400"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-serif tracking-tight flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
              Claudio
            </h1>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#d97757] to-[#b35538] flex items-center justify-center text-sm font-serif text-white shadow-sm">
            C
          </div>
        </header>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto w-full flex justify-center pb-40">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center max-w-3xl mt-12 md:mt-0">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#f2ece4] to-[#e6d8cc] dark:from-[#2d2d2d] dark:to-[#252525] flex items-center justify-center mb-8 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50 rotate-3 transition-transform hover:rotate-6">
                <Sparkles size={36} className="text-[#d97757]" />
              </div>
              <h2 className="text-4xl md:text-5xl font-serif text-zinc-800 dark:text-zinc-200 mb-6 tracking-tight leading-tight">
                Hola, soy <span className="text-[#d97757]">Claudio</span>.
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-lg font-light max-w-xl leading-relaxed">
                Una inteligencia artificial diseñada para ser tu asistente personal, ayudarte a escribir, analizar y pensar con claridad.
              </p>
            </div>
          ) : (
            <div className="w-full max-w-3xl flex flex-col gap-8 px-6 py-8">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "model" && (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#f2ece4] to-[#e6d8cc] dark:from-[#2d2d2d] dark:to-[#252525] flex items-center justify-center shrink-0 mt-1 border border-zinc-200/50 dark:border-zinc-700/50">
                      <Sparkles size={16} className="text-[#d97757]" />
                    </div>
                  )}
                  
                  <div className={`max-w-[85%] md:max-w-[80%] px-6 py-4 rounded-2xl ${
                    msg.role === "user" 
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-tr-sm" 
                      : "bg-white dark:bg-[#1e1e1e] text-zinc-800 dark:text-zinc-300 shadow-sm border border-zinc-100 dark:border-zinc-800/60 rounded-tl-sm"
                  }`}>
                    {msg.role === "model" ? (
                      <div className="prose prose-zinc dark:prose-invert max-w-none text-[15px] leading-relaxed font-light">
                        {msg.content.split('\n').map((line, i) => (
                          <p key={i} className="mb-3 last:mb-0 min-h-[1.5rem] tracking-wide">{line}</p>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[15px] font-light tracking-wide">{msg.content}</div>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-4 justify-start">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#f2ece4] to-[#e6d8cc] dark:from-[#2d2d2d] dark:to-[#252525] flex items-center justify-center shrink-0 mt-1 border border-zinc-200/50 dark:border-zinc-700/50">
                    <Sparkles size={16} className="text-[#d97757]" />
                  </div>
                  <div className="px-6 py-4 text-zinc-400 dark:text-zinc-500 flex items-center gap-3 text-sm font-light italic">
                    <Loader2 size={16} className="animate-spin text-[#d97757]" />
                    Claudio está pensando...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-white via-white to-transparent dark:from-[#1e1e1e] dark:via-[#1e1e1e] pt-10 pb-8 px-6">
          <div className="max-w-3xl mx-auto relative">
            <div className="bg-zinc-50 dark:bg-[#252525] rounded-2xl border border-zinc-200 dark:border-zinc-700 focus-within:bg-white dark:focus-within:bg-[#2a2a2a] focus-within:border-zinc-300 dark:focus-within:border-zinc-600 focus-within:shadow-md transition-all flex items-end overflow-hidden">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pregúntale a Claudio..."
                className="w-full bg-transparent text-zinc-800 dark:text-zinc-200 px-6 py-5 max-h-48 resize-none focus:outline-none text-[15px] font-light placeholder:text-zinc-400"
                rows={Math.min(5, input.split("\n").length || 1)}
                style={{ minHeight: '64px' }}
                disabled={isLoading}
              />
              <div className="p-3 shrink-0">
                <button
                  onClick={() => handleSubmit()}
                  disabled={!input.trim() || isLoading}
                  className="w-10 h-10 rounded-xl bg-[#d97757] text-white flex items-center justify-center disabled:opacity-50 disabled:bg-zinc-200 dark:disabled:bg-zinc-700 disabled:text-zinc-400 hover:bg-[#b35538] transition-colors shadow-sm"
                >
                  <Send size={18} className={input.trim() ? "translate-x-[1px] translate-y-[-1px]" : ""} />
                </button>
              </div>
            </div>
            <div className="text-center mt-4 text-xs font-light text-zinc-400 dark:text-zinc-500 tracking-wide">
              Claudio puede generar información inexacta. Verifica siempre los datos importantes.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
