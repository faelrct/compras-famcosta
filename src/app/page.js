'use client';

import React, { useState, useEffect } from 'react';
import Script from 'next/script';
import { createClient } from '@supabase/supabase-js';

// Credenciais Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://abopaplifnrruoxjfrgn.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFib3BhcGxpZm5ycnVveGpmcmduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMTU1MDksImV4cCI6MjEwMTY5MTUwOX0.LPw0TfRUhpbm7VwmfdJTIhvfDbFM6SDO8TONh-l19qA';
const supabase = createClient(supabaseUrl, supabaseKey);

// SITE KEY DO CLOUDFLARE TURNSTILE
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAEMqBGt8_k0H6FSp';

const SHOP_CATEGORIES = [
  { name: 'Todos', icon: '✨' },
  { name: 'Comidas', icon: '🍔' },
  { name: 'Limpeza', icon: '🧼' },
  { name: 'Higiene', icon: '🪥' },
  { name: 'Outros', icon: '📦' },
];

const formatCurrencyInput = (value) => {
  const digitsOnly = value.replace(/\D/g, '');
  if (!digitsOnly) return '';
  const numberValue = parseFloat(digitsOnly) / 100;
  return numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatBRL = (val) => {
  return Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function App() {
  // Autenticação e Sessão
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  
  // Login por Usuário
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  // Navegação
  const [activeTab, setActiveTab] = useState('fatura');

  // Compras (Compartilhadas / Universal)
  const [shopItems, setShopItems] = useState([]);
  const [selectedShopCategory, setSelectedShopCategory] = useState('Todos');
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [editingShopItem, setEditingShopItem] = useState(null);
  const [shopName, setShopName] = useState('');
  const [shopQuantity, setShopQuantity] = useState(1);
  const [shopPrice, setShopPrice] = useState('');
  const [shopCategory, setShopCategory] = useState('Comidas');

  // Fatura (Individual por Usuário)
  const [availableMoney, setAvailableMoney] = useState(0);
  const [faturaItems, setFaturaItems] = useState([]);
  const [isEditMoneyOpen, setIsEditMoneyOpen] = useState(false);
  const [moneyInput, setMoneyInput] = useState('');
  const [isFaturaModalOpen, setIsFaturaModalOpen] = useState(false);
  const [faturaTargetCategory, setFaturaTargetCategory] = useState('mae');
  const [faturaDescription, setFaturaDescription] = useState('');
  const [faturaTotalAmountInput, setFaturaTotalAmountInput] = useState('');
  const [faturaInstallments, setFaturaInstallments] = useState(1);

  // 1. VERIFICAÇÃO DE SESSÃO DO USUÁRIO
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoadingSession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // AUTO-LOGOUT POR INATIVIDADE (15 Minutos)
  useEffect(() => {
    if (!session) return;

    const INACTIVITY_LIMIT = 15 * 60 * 1000; 
    let timer;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await supabase.auth.signOut();
        alert('Sua sessão expirou por inatividade. Faça login novamente.');
      }, INACTIVITY_LIMIT);
    };

    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    activityEvents.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timer);
      activityEvents.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [session]);

  // REGISTRAR CALLBACKS DO CLOUDFLARE TURNSTILE
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.onTurnstileSuccess = (token) => {
        setCaptchaToken(token);
      };

      window.onTurnstileExpire = () => {
        setCaptchaToken('');
      };
    }
  }, []);

  // 2. BUSCAR DADOS QUANDO LOGADO
  useEffect(() => {
    if (session?.user) {
      fetchShopItems();
      fetchFaturaData();

      const shopChannel = supabase
        .channel('realtime-items')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => fetchShopItems())
        .subscribe();

      const faturaChannel = supabase
        .channel('realtime-fatura')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'fatura_items' }, () => fetchFaturaData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'fatura_config' }, () => fetchFaturaData())
        .subscribe();

      return () => {
        supabase.removeChannel(shopChannel);
        supabase.removeChannel(faturaChannel);
      };
    }
  }, [session]);

  const fetchShopItems = async () => {
    const { data } = await supabase.from('items').select('*').order('created_at', { ascending: true });
    if (data) setShopItems(data);
  };

  const fetchFaturaData = async () => {
    if (!session?.user) return;
    
    // .maybeSingle() previne erros caso o usuário ainda não tenha registro na tabela
    const { data: configData } = await supabase
      .from('fatura_config')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (configData) setAvailableMoney(Number(configData.available_money) || 0);

    const { data: itemsData } = await supabase
      .from('fatura_items')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true });

    if (itemsData) setFaturaItems(itemsData);
  };

  // --- LOGIN POR USUÁRIO ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (!captchaToken) {
      setAuthError('Por favor, aguarde o captcha confirmar a verificação.');
      return;
    }

    setAuthLoading(true);

    const formattedEmail = authUsername.includes('@') 
      ? authUsername.trim() 
      : `${authUsername.trim().toLowerCase()}@app.local`;

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formattedEmail,
        password: authPassword,
        options: { captchaToken }
      });
      if (error) throw error;
    } catch (err) {
      setAuthError(err.message || 'Erro ao realizar login.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // --- AÇÕES COMPRAS (UNIVERSAL) ---
  const openShopModal = (item = null) => {
    if (item) {
      setEditingShopItem(item);
      setShopName(item.name);
      setShopQuantity(item.quantity);
      setShopPrice(item.price ? formatBRL(item.price) : '');
      setShopCategory(item.category);
    } else {
      setEditingShopItem(null);
      setShopName('');
      setShopQuantity(1);
      setShopPrice('');
      setShopCategory('Comidas');
    }
    setIsShopModalOpen(true);
  };

  const handleSaveShopItem = async (e) => {
    e.preventDefault();
    const numericPrice = parseFloat(shopPrice.replace(/\./g, '').replace(',', '.')) || 0;

    let res;
    if (editingShopItem) {
      res = await supabase
        .from('items')
        .update({ name: shopName, quantity: Number(shopQuantity), price: numericPrice, category: shopCategory })
        .eq('id', editingShopItem.id);
    } else {
      res = await supabase
        .from('items')
        .insert([{ name: shopName, quantity: Number(shopQuantity), price: numericPrice, category: shopCategory, user_id: session.user.id }]);
    }

    if (res.error) {
      alert('Erro ao salvar item na lista de compras: ' + res.error.message);
    } else {
      setIsShopModalOpen(false);
      fetchShopItems();
    }
  };

  const handleDeleteShopItem = async (id) => {
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) {
      alert('Erro ao excluir item das compras: ' + error.message);
    } else {
      fetchShopItems();
    }
  };

  const handleClearShopList = async () => {
    if (confirm('Tem certeza que deseja apagar toda a lista de compras compartilhada?')) {
      const { error } = await supabase.from('items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) alert('Erro ao limpar lista de compras: ' + error.message);
      else fetchShopItems();
    }
  };

  // --- AÇÕES FATURA (INDIVIDUAL) ---
  const handleSaveAvailableMoney = async (e) => {
    e.preventDefault();
    const numericMoney = parseFloat(moneyInput.replace(/\./g, '').replace(',', '.')) || 0;

    // 1. Tenta ATUALIZAR a chave existente do usuário
    const { data, error: updateError } = await supabase
      .from('fatura_config')
      .update({ available_money: numericMoney })
      .eq('user_id', session.user.id)
      .select();

    if (updateError) {
      alert('Erro ao atualizar dinheiro disponível: ' + updateError.message);
      return;
    }

    // 2. Se não atualizou nada (primeiro acesso do usuário), INSERE uma nova linha
    if (!data || data.length === 0) {
      const { error: insertError } = await supabase
        .from('fatura_config')
        .insert([{ user_id: session.user.id, available_money: numericMoney }]);

      if (insertError) {
        alert('Erro ao criar dinheiro disponível: ' + insertError.message);
        return;
      }
    }

    // 3. Sucesso! Atualiza os estados locais da tela
    setAvailableMoney(numericMoney);
    setIsEditMoneyOpen(false);
    fetchFaturaData();
  };

  const openAddFaturaItem = (categoryKey) => {
    setFaturaTargetCategory(categoryKey);
    setFaturaDescription('');
    setFaturaTotalAmountInput('');
    setFaturaInstallments(1);
    setIsFaturaModalOpen(true);
  };

  const handleSaveFaturaItem = async (e) => {
    e.preventDefault();
    const totalAmount = parseFloat(faturaTotalAmountInput.replace(/\./g, '').replace(',', '.')) || 0;
    const installmentsCount = parseInt(faturaInstallments) || 1;
    const monthlyAmount = totalAmount / installmentsCount;

    const { error } = await supabase.from('fatura_items').insert([
      { 
        description: faturaDescription, 
        total_amount: totalAmount,
        installments: installmentsCount,
        amount: monthlyAmount, 
        category: faturaTargetCategory,
        user_id: session.user.id
      }
    ]);

    if (error) {
      alert('Erro ao salvar item na fatura: ' + error.message);
    } else {
      setIsFaturaModalOpen(false);
      fetchFaturaData();
    }
  };

  const handleDeleteFaturaItem = async (id) => {
    const { error } = await supabase.from('fatura_items').delete().eq('id', id);
    if (error) {
      alert('Erro ao excluir item da fatura: ' + error.message);
    } else {
      fetchFaturaData();
    }
  };

  // Cálculos Fatura
  const aReceberTotal = faturaItems.filter(i => i.category === 'a_receber').reduce((acc, i) => acc + Number(i.amount || 0), 0);
  const cartaoMaeTotal = faturaItems.filter(i => i.category === 'mae').reduce((acc, i) => acc + Number(i.amount || 0), 0);
  const meuCartaoTotal = faturaItems.filter(i => i.category === 'meu_cartao').reduce((acc, i) => acc + Number(i.amount || 0), 0);
  const saldoFinal = availableMoney + aReceberTotal - cartaoMaeTotal - meuCartaoTotal;

  // Cálculos Compras
  const shopTotalValue = shopItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const shopTotalItemsCount = shopItems.reduce((acc, item) => acc + item.quantity, 0);
  const filteredShopItems = selectedShopCategory === 'Todos' ? shopItems : shopItems.filter(item => item.category === selectedShopCategory);

  // TELA DE CARREGAMENTO INICIAL
  if (loadingSession) {
    return (
      <div className="min-h-screen bg-[#0D0D12] text-white flex items-center justify-center font-sans">
        <p className="text-gray-400 text-sm animate-pulse">Carregando sistema seguro...</p>
      </div>
    );
  }

  // TELA DE LOGIN (POR USUÁRIO)
  if (!session) {
    return (
      <div className="min-h-screen bg-[#0D0D12] text-white flex items-center justify-center p-4 font-sans select-none">
        <div className="bg-[#181820] border border-[#232330] w-full max-w-sm rounded-3xl p-6 flex flex-col gap-5 shadow-2xl">
          <div className="text-center">
            <h1 className="text-2xl font-black text-white">Acessar Sistema</h1>
            <p className="text-xs text-gray-400 mt-1">
              Informe seu usuário e senha para continuar
            </p>
          </div>

          {authError && (
            <div className="bg-red-950/50 border border-red-500/50 text-red-300 text-xs p-3 rounded-xl text-center font-medium">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Usuário</label>
              <input
                type="text"
                required
                placeholder="Digite seu usuário"
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                className="w-full bg-[#111116] border border-[#272732] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#00E676]"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Senha</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-[#111116] border border-[#272732] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#00E676]"
              />
            </div>

            {/* Cloudflare Turnstile CAPTCHA Widget Container com Carregamento Otimizado */}
            <Script 
              src="https://challenges.cloudflare.com/turnstile/v0/api.js" 
              strategy="afterInteractive" 
            />
            <div className="flex justify-center my-1 min-h-[65px]">
              <div 
                className="cf-turnstile" 
                data-sitekey={TURNSTILE_SITE_KEY}
                data-callback="onTurnstileSuccess"
                data-expired-callback="onTurnstileExpire"
              ></div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-[#00E676] text-black py-3 rounded-xl text-xs font-extrabold hover:bg-[#00c853] transition-transform active:scale-95 mt-1"
            >
              {authLoading ? 'Aguarde...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // TELA PRINCIPAL DO APP (LOGADO)
  return (
    <div className="min-h-screen bg-[#0D0D12] text-white flex justify-center pb-24 font-sans select-none">
      <div className="w-full max-w-md px-4 pt-4 flex flex-col gap-5">

        {/* Topo com Usuário e Logout */}
        <div className="flex justify-between items-center bg-[#181820] p-3 rounded-2xl border border-[#232330]">
          <div className="truncate pr-2">
            <span className="text-[10px] text-gray-400 block">Usuário conectado</span>
            <span className="text-xs font-bold text-gray-200 truncate block">
              {session.user.email?.replace('@app.local', '')}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="bg-[#2B1B20] text-red-400 border border-[#42222E] text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-red-900/30 transition-transform active:scale-95"
          >
            Sair
          </button>
        </div>

        {/* ================= ABA: FATURA DO MÊS ================= */}
        {activeTab === 'fatura' && (
          <>
            <div>
              <p className="text-xs text-gray-400 font-medium">Sua fatura privada 📊</p>
              <h1 className="text-2xl font-black tracking-tight text-white mt-0.5">Fatura do Mês</h1>
            </div>

            <div className="bg-[#181820] p-4 rounded-2xl border border-[#232330] flex justify-between items-center">
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold block mb-1">
                  MEU DINHEIRO DISPONÍVEL
                </span>
                <span className="text-2xl font-black text-[#00E676]">R$ {formatBRL(availableMoney)}</span>
              </div>
              <button
                onClick={() => {
                  setMoneyInput(formatBRL(availableMoney));
                  setIsEditMoneyOpen(true);
                }}
                className="bg-[#242432] hover:bg-[#2e2e3f] text-xs font-semibold px-3 py-1.5 rounded-full text-gray-300 border border-[#323246]"
              >
                ✏️ Editar
              </button>
            </div>

            <div className="bg-[#141A18] p-4 rounded-2xl border border-[#1C382B] flex flex-col gap-3">
              <h2 className="text-sm font-bold text-gray-200">Resumo do mês</h2>
              <div className="flex flex-col gap-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">💰 Dinheiro disponível</span>
                  <span className="font-bold text-[#00E676]">R$ {formatBRL(availableMoney)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">📬 A receber</span>
                  <span className="font-bold text-[#00E676]">+ R$ {formatBRL(aReceberTotal)}</span>
                </div>
                <hr className="border-[#21352A] my-0.5" />
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">💳 Cartão da mãe</span>
                  <span className="font-bold text-[#FF4081]">- R$ {formatBRL(cartaoMaeTotal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">💙 Meu cartão</span>
                  <span className="font-bold text-[#00B0FF]">- R$ {formatBRL(meuCartaoTotal)}</span>
                </div>
              </div>
              <hr className="border-[#21352A] my-0.5" />
              <div className="flex justify-between items-center pt-1">
                <span className="text-sm font-bold text-white">Saldo final</span>
                <span className={`text-lg font-black ${saldoFinal < 0 ? 'text-red-500' : 'text-[#00E676]'}`}>
                  R$ {formatBRL(saldoFinal)}
                </span>
              </div>
            </div>

            {/* Seções Fatura */}
            {[
              { id: 'mae', title: '💳 Cartão da Mãe', color: '#FF4081', bg: '#2A1D28', border: '#3E2337', total: cartaoMaeTotal },
              { id: 'meu_cartao', title: '💙 Meu Cartão', color: '#00B0FF', bg: '#1B2836', border: '#1E384D', total: meuCartaoTotal },
              { id: 'a_receber', title: '💰 A Receber', color: '#00E676', bg: '#1B2D24', border: '#214332', total: aReceberTotal },
            ].map(sec => (
              <div key={sec.id} className="bg-[#181820] p-4 rounded-2xl border border-[#232330] flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-white">{sec.title}</h3>
                    <span className="text-xs text-gray-400">Total: R$ {formatBRL(sec.total)}</span>
                  </div>
                  <button
                    onClick={() => openAddFaturaItem(sec.id)}
                    className="w-9 h-9 rounded-xl font-bold text-lg flex items-center justify-center"
                    style={{ backgroundColor: sec.bg, color: sec.color, borderColor: sec.border, borderWidth: '1px' }}
                  >
                    +
                  </button>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  {faturaItems.filter(i => i.category === sec.id).length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-2">Nenhum item cadastrado</p>
                  ) : (
                    faturaItems.filter(i => i.category === sec.id).map(item => (
                      <div key={item.id} className="flex justify-between items-center bg-[#111118] p-3 rounded-xl border border-[#232332] text-xs">
                        <div>
                          <span className="font-semibold text-gray-100 block">{item.description}</span>
                          {sec.id !== 'a_receber' && (
                            <span className="text-[10px] text-gray-400">
                              Total: R$ {formatBRL(item.total_amount)} {item.installments > 1 ? `(${item.installments}x)` : ''}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold" style={{ color: sec.color }}>R$ {formatBRL(item.amount)}</span>
                          <button onClick={() => handleDeleteFaturaItem(item.id)} className="text-gray-500 hover:text-red-400 px-1">✕</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ================= ABA: COMPRAS (COMPARTILHADA) ================= */}
        {activeTab === 'compras' && (
          <>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-400 font-medium">Lista compartilhada 🛒</p>
                <h1 className="text-2xl font-extrabold tracking-tight">Minha Lista</h1>
              </div>
              <button onClick={() => openShopModal()} className="w-12 h-12 bg-[#FF5722] text-white text-2xl font-bold rounded-full flex items-center justify-center shadow-lg">+</button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#1C1C24] p-3 rounded-2xl flex flex-col justify-between border border-[#272732]">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Total</span>
                <span className="text-sm font-bold text-white mt-1">R$ {formatBRL(shopTotalValue)}</span>
              </div>
              <div className="bg-[#1C1C24] p-3 rounded-2xl flex flex-col justify-between border border-[#272732]">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Itens</span>
                <span className="text-sm font-bold text-white mt-1">{shopTotalItemsCount}</span>
              </div>
              <button onClick={handleClearShopList} className="bg-[#1C1C24] p-3 rounded-2xl flex items-center justify-center border border-[#272732] hover:bg-red-950/30">
                <span className="text-xs font-bold text-red-500">Limpar</span>
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              {SHOP_CATEGORIES.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setSelectedShopCategory(cat.name)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap ${
                    selectedShopCategory === cat.name ? 'bg-[#FF5722] text-white' : 'bg-[#1C1C24] text-gray-300 border border-[#272732]'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              {filteredShopItems.length === 0 ? (
                <div className="text-center text-gray-500 py-10 text-sm">Nenhum item na lista compartilhada.</div>
              ) : (
                filteredShopItems.map((item) => (
                  <div key={item.id} className="bg-[#1C1C24] p-4 rounded-2xl flex justify-between items-center border-l-4 border-l-[#00E676] border-y border-r border-[#272732]">
                    <div className="flex flex-col gap-1.5">
                      <span className="font-semibold text-sm text-gray-100">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="bg-[#272732] text-xs px-2.5 py-0.5 rounded-full text-gray-300 flex items-center gap-1">
                          {SHOP_CATEGORIES.find((c) => c.name === item.category)?.icon || '📦'} {item.category}
                        </span>
                        <span className="text-xs text-gray-400 font-medium">x{item.quantity}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs text-gray-400 block">Total</span>
                        <span className="font-bold text-sm text-white">R$ {formatBRL(item.price * item.quantity)}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openShopModal(item)} className="w-8 h-8 rounded-full bg-[#272732] text-yellow-400 flex items-center justify-center text-xs">✏️</button>
                        <button onClick={() => handleDeleteShopItem(item.id)} className="w-8 h-8 rounded-full bg-[#321C24] text-red-400 flex items-center justify-center text-xs">✕</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

      </div>

      {/* BARRA INFERIOR DE NAVEGAÇÃO */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#121218]/95 backdrop-blur-md border-t border-[#22222E] flex justify-around items-center py-2.5 z-40 max-w-md mx-auto">
        <button onClick={() => setActiveTab('fatura')} className="flex flex-col items-center gap-1 relative px-8 py-1">
          {activeTab === 'fatura' && <div className="absolute -top-2.5 w-12 h-1 bg-[#FFB74D] rounded-full" />}
          <span className={`text-xl ${activeTab === 'fatura' ? 'opacity-100' : 'opacity-40'}`}>📊</span>
          <span className={`text-xs font-bold ${activeTab === 'fatura' ? 'text-[#FFB74D]' : 'text-gray-500'}`}>Fatura</span>
        </button>

        <button onClick={() => setActiveTab('compras')} className="flex flex-col items-center gap-1 relative px-8 py-1">
          {activeTab === 'compras' && <div className="absolute -top-2.5 w-12 h-1 bg-[#FF5722] rounded-full" />}
          <span className={`text-xl ${activeTab === 'compras' ? 'opacity-100' : 'opacity-40'}`}>🛒</span>
          <span className={`text-xs font-bold ${activeTab === 'compras' ? 'text-[#FF5722]' : 'text-gray-500'}`}>Compras</span>
        </button>
      </div>

      {/* MODAIS (DINHEIRO, FATURA, COMPRAS) */}
      {isEditMoneyOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1C1C24] border border-[#272732] w-full max-w-md rounded-3xl p-6 text-white flex flex-col gap-4">
            <h2 className="text-lg font-bold">Editar Dinheiro Disponível</h2>
            <form onSubmit={handleSaveAvailableMoney} className="flex flex-col gap-3">
              <input
                type="text"
                inputMode="numeric"
                required
                placeholder="0,00"
                value={moneyInput}
                onChange={(e) => setMoneyInput(formatCurrencyInput(e.target.value))}
                className="w-full bg-[#111116] border border-[#272732] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#00E676]"
              />
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => setIsEditMoneyOpen(false)} className="flex-1 bg-[#272732] py-2.5 rounded-xl text-xs font-semibold text-gray-300">Cancelar</button>
                <button type="submit" className="flex-1 bg-[#00E676] text-black py-2.5 rounded-xl text-xs font-bold">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isFaturaModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1C1C24] border border-[#272732] w-full max-w-md rounded-3xl p-6 text-white flex flex-col gap-4">
            <h2 className="text-lg font-bold">Novo Item na Fatura</h2>
            <form onSubmit={handleSaveFaturaItem} className="flex flex-col gap-3">
              <input
                type="text"
                required
                placeholder="Descrição"
                value={faturaDescription}
                onChange={(e) => setFaturaDescription(e.target.value)}
                className="w-full bg-[#111116] border border-[#272732] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#00E676]"
              />
              <div className={`grid ${faturaTargetCategory === 'a_receber' ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="Valor Total (R$)"
                  value={faturaTotalAmountInput}
                  onChange={(e) => setFaturaTotalAmountInput(formatCurrencyInput(e.target.value))}
                  className="w-full bg-[#111116] border border-[#272732] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#00E676]"
                />
                {faturaTargetCategory !== 'a_receber' && (
                  <input
                    type="number"
                    min="1"
                    required
                    value={faturaInstallments}
                    onChange={(e) => setFaturaInstallments(e.target.value)}
                    className="w-full bg-[#111116] border border-[#272732] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#00E676]"
                  />
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => setIsFaturaModalOpen(false)} className="flex-1 bg-[#272732] py-2.5 rounded-xl text-xs font-semibold text-gray-300">Cancelar</button>
                <button type="submit" className="flex-1 bg-[#00E676] text-black py-2.5 rounded-xl text-xs font-bold">Adicionar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isShopModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1C1C24] border border-[#272732] w-full max-w-md rounded-3xl p-6 text-white flex flex-col gap-4">
            <h2 className="text-lg font-bold">{editingShopItem ? 'Editar Item' : 'Novo Item'}</h2>
            <form onSubmit={handleSaveShopItem} className="flex flex-col gap-3">
              <input
                type="text"
                required
                placeholder="Nome do Produto"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full bg-[#111116] border border-[#272732] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FF5722]"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min="1"
                  required
                  value={shopQuantity}
                  onChange={(e) => setShopQuantity(e.target.value)}
                  className="w-full bg-[#111116] border border-[#272732] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FF5722]"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Valor Unitário (R$)"
                  value={shopPrice}
                  onChange={(e) => setShopPrice(formatCurrencyInput(e.target.value))}
                  className="w-full bg-[#111116] border border-[#272732] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FF5722]"
                />
              </div>
              <select
                value={shopCategory}
                onChange={(e) => setShopCategory(e.target.value)}
                className="w-full bg-[#111116] border border-[#272732] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FF5722]"
              >
                {SHOP_CATEGORIES.filter((c) => c.name !== 'Todos').map((c) => (
                  <option key={c.name} value={c.name}>{c.icon} {c.name}</option>
                ))}
              </select>
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => setIsShopModalOpen(false)} className="flex-1 bg-[#272732] py-2.5 rounded-xl text-xs font-semibold text-gray-300">Cancelar</button>
                <button type="submit" className="flex-1 bg-[#FF5722] py-2.5 rounded-xl text-xs font-semibold text-white">{editingShopItem ? 'Atualizar' : 'Adicionar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}