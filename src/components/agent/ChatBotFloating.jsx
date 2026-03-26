import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { X, Minimize2, Maximize2, Send, Bot, Loader2, MessageCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function ChatBotFloating({ agentName = 'copiloto_erp' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const dragPos = useRef(() => {
    try {
      const saved = localStorage.getItem('copiloto_position');
      return saved ? JSON.parse(saved) : { x: window.innerWidth - 100, y: window.innerHeight - 100 };
    } catch { return { x: window.innerWidth - 100, y: window.innerHeight - 100 }; }
  });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const buttonRef = useRef(null);
  const chatContainerRef = useRef(null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const messagesEndRef = useRef(null);
  const chatRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const applyPosition = useCallback((pos, el) => {
    if (!el) return;
    el.style.left = pos.x + 'px';
    el.style.top = pos.y + 'px';
  }, []);

  useEffect(() => {
    initConversation();
  }, []);

  useEffect(() => {
    // Solo auto-scroll si no hay posición guardada (primera carga) o si el usuario está cerca del final
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      
      if (scrollPosition === 0 || isNearBottom) {
        scrollToBottom();
      }
    }
  }, [messages]);

  useEffect(() => {
    if (!conversation) return;
    
    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [conversation?.id]);

  const initConversation = async () => {
    try {
      // Intentar recuperar conversación existente del localStorage
      const savedConvId = localStorage.getItem('copiloto_conversation_id');
      
      if (savedConvId) {
        try {
          const existingConv = await base44.agents.getConversation(savedConvId);
          setConversation(existingConv);
          setMessages(existingConv.messages || []);
          return;
        } catch (e) {
          console.log('Conversación anterior no encontrada, creando nueva');
        }
      }

      // Crear nueva conversación
      const newConv = await base44.agents.createConversation({
        agent_name: agentName,
        metadata: {
          name: 'Sesión Copiloto ERP',
          description: 'Asistente conversacional del sistema'
        }
      });
      
      setConversation(newConv);
      localStorage.setItem('copiloto_conversation_id', newConv.id);
      
      // Mensaje de bienvenida
      setMessages([{
        role: 'assistant',
        content: '¡Hola! Soy tu **Copiloto ERP** 🤖\n\nEstoy aquí para ayudarte a comprender el sistema:\n\n📊 **Explicar cálculos y fórmulas**\n🔗 **Mostrar cómo se relacionan los módulos**\n📋 **Guiarte en flujos de trabajo**\n🔍 **Detectar inconsistencias en datos**\n📚 **Actuar como documentación viva**\n\n¿En qué puedo ayudarte?'
      }]);
    } catch (error) {
      console.error('Error iniciando conversación:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputMessage.trim() || !conversation || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    try {
      await base44.agents.addMessage(conversation, {
        role: 'user',
        content: userMessage
      });
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      setIsLoading(false);
    }
  };

  const handleMouseDown = useCallback((e) => {
    if (isMaximized) return;
    e.preventDefault();
    const pos = dragPos.current();
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y
    };

    const onMouseMove = (ev) => {
      if (!isDraggingRef.current) return;
      const el = isOpen ? chatRef.current : buttonRef.current;
      const size = el ? el.getBoundingClientRect() : { width: 64, height: 64 };
      const newX = Math.max(0, Math.min(ev.clientX - dragStartRef.current.x, window.innerWidth - size.width));
      const newY = Math.max(0, Math.min(ev.clientY - dragStartRef.current.y, window.innerHeight - size.height));
      const newPos = { x: newX, y: newY };
      dragPos.current = () => newPos;
      applyPosition(newPos, el);
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      const pos = dragPos.current();
      localStorage.setItem('copiloto_position', JSON.stringify(pos));
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [isMaximized, isOpen, applyPosition]);

  const MessageBubble = ({ message }) => {
    const isUser = message.role === 'user';
    
    return (
      <div className={`flex gap-3 mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
        {!isUser && (
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
        )}
        <div className={`max-w-[80%] ${isUser && 'flex flex-col items-end'}`}>
          {message.content && (
            <div className={`rounded-2xl px-4 py-3 ${
              isUser 
                ? 'bg-slate-800 text-white' 
                : 'bg-white border border-slate-200 shadow-sm'
            }`}>
              {isUser ? (
                <p className="text-sm leading-relaxed">{message.content}</p>
              ) : (
                <ReactMarkdown 
                  className="text-sm prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                  components={{
                    p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
                    ul: ({ children }) => <ul className="my-2 ml-4 list-disc">{children}</ul>,
                    ol: ({ children }) => <ol className="my-2 ml-4 list-decimal">{children}</ol>,
                    li: ({ children }) => <li className="my-1">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                    code: ({ inline, children }) => 
                      inline ? (
                        <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-mono">
                          {children}
                        </code>
                      ) : (
                        <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto my-2">
                          <code className="text-xs">{children}</code>
                        </pre>
                      ),
                    h1: ({ children }) => <h1 className="text-base font-bold my-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-sm font-bold my-2">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold my-2">{children}</h3>,
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              )}
            </div>
          )}
        </div>
        {isUser && (
          <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">TÚ</span>
          </div>
        )}
      </div>
    );
  };

  const handleToggleOpen = () => {
    if (isOpen && messagesContainerRef.current) {
      // Guardar posición del scroll antes de cerrar
      setScrollPosition(messagesContainerRef.current.scrollTop);
    } else {
      // Restaurar posición del scroll al abrir
      setTimeout(() => {
        if (messagesContainerRef.current && scrollPosition > 0) {
          messagesContainerRef.current.scrollTop = scrollPosition;
        }
      }, 100);
    }
    setIsOpen(!isOpen);
  };

  // Posición inicial para el elemento flotante
  const initPos = dragPos.current();

  // Bola flotante minimizada
  if (!isOpen) {
    return (
      <button
        ref={buttonRef}
        onMouseDown={handleMouseDown}
        onClick={handleToggleOpen}
        style={{ 
          position: 'fixed', 
          left: initPos.x + 'px',
          top: initPos.y + 'px',
          zIndex: 9999,
          cursor: 'grab',
          userSelect: 'none',
        }}
        className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-2xl hover:shadow-emerald-500/50 transition-shadow duration-300 flex items-center justify-center group"
        title="Abrir Copiloto ERP"
      >
        <MessageCircle className="w-7 h-7 md:w-8 md:h-8 text-white group-hover:animate-pulse" />
        <div className="absolute -top-1 -right-1 h-3 w-3 md:h-4 md:w-4 bg-red-500 rounded-full animate-pulse" />
      </button>
    );
  }

  // Chat abierto
  const chatStyle = isMaximized
    ? { position: 'fixed', top: '20px', left: '20px', right: '20px', bottom: '20px', width: 'auto', height: 'auto', zIndex: 9999 }
    : { 
        position: 'fixed', 
        left: initPos.x + 'px',
        top: initPos.y + 'px',
        width: 'min(400px, calc(100vw - 48px))', 
        height: 'min(600px, calc(100vh - 100px))',
        zIndex: 9999,
        userSelect: 'none',
      };

  return (
    <div
      ref={chatRef}
      style={chatStyle}
      className="bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div
        onMouseDown={handleMouseDown}
        style={{ cursor: isMaximized ? 'default' : 'grab' }}
        className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white p-3 md:p-4 flex items-center justify-between select-none"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base">Copiloto ERP</h3>
            <p className="text-xs text-emerald-100">Asistente del Sistema</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMaximized(!isMaximized)}
            className="text-white hover:bg-white/20 h-8 w-8"
            title={isMaximized ? 'Restaurar' : 'Maximizar'}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleOpen}
            className="text-white hover:bg-white/20 h-8 w-8"
            title="Minimizar"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-slate-50 to-white"
      >
        {messages.map((msg, idx) => (
          <MessageBubble key={idx} message={msg} />
        ))}
        {isLoading && (
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span className="text-sm text-slate-600">Pensando...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-white">
        <div className="flex gap-2">
          <Textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Pregunta sobre el sistema..."
            className="resize-none text-sm"
            rows={2}
            disabled={isLoading}
          />
          <Button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 h-auto px-4"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Presiona Enter para enviar • Shift+Enter para nueva línea
        </p>
      </form>
    </div>
  );
}