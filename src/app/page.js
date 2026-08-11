'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Credenciais Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://abopaplifnrruoxjfrgn.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFib3BhcGxpZm5ycnVveGpmcmduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMTU1MDksImV4cCI6MjEwMTY5MTUwOX0.LPw0TfRUhpbm7VwmfdJTIhvfDbFM6SDO8TONh-l19qA';
const supabase = createClient(supabaseUrl, supabaseKey);

const SHOP_CATEGORIES = [
  { name: 'Todos', icon: '✨' },
  { name: 'Comidas', icon: '🍔' },
  { name: 'Limpeza', icon: '🧼' },
  { name: 'Higiene', icon: '🪥' },
  { name: 'Outros', icon: '📦' },
];

// Máscaras e Formatações de Moeda
const formatCurrencyInput = (value) => {
  const digitsOnly = value.replace(/\D/g, '');
  if (!digitsOnly) return '';
  const numberValue = parseFloat(digitsOnly) / 100;
  return numberValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatBRL = (val) => {
  return Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function App() {
  // Navegação Principal (Apenas 2 abas agora)
  const [activeTab, setActiveTab] = useState('fatura'); // 'fatura' | 'compras'

  // --- ESTADO DA LISTA DE COMPRAS ---
  const [shopItems, setShopItems] = useState([]);
  const [selectedShopCategory, setSelectedShopCategory] = useState('Todos');
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [editingShopItem, setEditingShopItem] = useState(null);
  const [shopName, setShopName] = useState('');
  const [shopQuantity, setShopQuantity] = useState(1);
  const [shopPrice, setShopPrice] = useState('');
  const [shopCategory, setShopCategory] = useState('Comidas');

  // --- ESTADO DA FATURA DO MÊS ---
  const [availableMoney, setAvailableMoney] = useState(0);
  const [faturaItems, setFaturaItems] = useState([]);
  const [isEditMoneyOpen, setIsEditMoneyOpen] = useState(false);
  const [moneyInput, setMoneyInput] = useState('');
  
  const [isFaturaModalOpen, setIsFaturaModalOpen] = useState(false);
  const [faturaTargetCategory, setFaturaTargetCategory] = useState('mae'); // 'mae' | 'meu_cartao' | 'a_receber'
  const [faturaDescription, setFaturaDescription] = useState('');
  const [faturaTotalAmountInput, setFaturaTotalAmountInput] = useState('');
  const [faturaInstallments, setFaturaInstallments] = useState(1);

  // --- BUSCAR DADOS DO SUPABASE ---
  useEffect(() => {
    fetchShopItems();
    fetchFaturaData();

    // Inscrição em Tempo Real
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
  }, []);

  const fetchShopItems = async () => {
    const { data } = await supabase.from('items').select('*').order('created_at', { ascending: true });
    if (data) setShopItems(data);
  };

  const fetchFaturaData = async () => {
    const { data: configData } = await supabase.from('fatura_config').select('*').eq('id', 'main').single();
    if (configData) setAvailableMoney(Number(configData.available_money) || 0);

    const { data: itemsData } = await supabase.from('fatura_items').select('*').order('created_at', { ascending: true });
    if (itemsData) setFaturaItems(itemsData);
  };

  // --- AÇÕES DA LISTA DE COMPRAS ---
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

    if (editingShopItem) {
      await supabase
        .from('items')
        .update({ name: shopName, quantity: Number(shopQuantity), price: numericPrice, category: shopCategory })
        .eq('id', editingShopItem.id);
    } else {
      await supabase.from('items').insert([{ name: shopName, quantity: Number(shopQuantity), price: numericPrice, category: shopCategory }]);
    }
    setIsShopModalOpen(false);
  };

  const handleDeleteShopItem = async (id) => {
    await supabase.from('items').delete().eq('id', id);
  };

  const handleClearShopList = async () => {
    if (confirm('Tem certeza que deseja apagar toda a lista de compras?')) {
      await supabase.from('items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
  };

  // --- AÇÕES DA FATURA ---
  const handleSaveAvailableMoney = async (e) => {
    e.preventDefault();
    const numericMoney = parseFloat(moneyInput.replace(/\./g, '').replace(',', '.')) || 0;
    
    await supabase.from('fatura_config').upsert({ id: 'main', available_money: numericMoney });
    setAvailableMoney(numericMoney);
    setIsEditMoneyOpen(false);
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
    
    // Parcela Mensal
    const monthlyAmount = totalAmount / installmentsCount;

    const { error } = await supabase.from('fatura_items').insert([
      { 
        description: faturaDescription, 
        total_amount: totalAmount,
        installments: installmentsCount,
        amount: monthlyAmount, 
        category: faturaTargetCategory 
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
    await supabase.from('fatura_items').delete().eq('id', id);
    fetchFaturaData();
  };

  // Cálculos de Totais da Fatura
  const aReceberTotal = faturaItems
    .filter(i => i.category === 'a_receber')
    .reduce((acc, i) => acc + Number(i.amount || 0), 0);

  const cartaoMaeTotal = faturaItems
    .filter(i => i.category === 'mae')
    .reduce((acc, i) => acc + Number(i.amount || 0), 0);

  const meuCartaoTotal = faturaItems
    .filter(i => i.category === 'meu_cartao')
    .reduce((acc, i) => acc + Number(i.amount || 0), 0);

  const saldoFinal = availableMoney + aReceberTotal - cartaoMaeTotal - meuCartaoTotal;

  // Cálculos de Compras
  const shopTotalValue = shopItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const shopTotalItemsCount = shopItems.reduce((acc, item) => acc + item.quantity, 0);
  const filteredShopItems = selectedShopCategory === 'Todos' 
    ? shopItems 
    : shopItems.filter(item => item.category === selectedShopCategory);

  return (
    <div className="min-h-screen bg-[#0D0D12] text-white flex justify-center pb-24 font-sans select-none">
      <div className="w-full max-w-md px-4 pt-6 flex flex-col gap-5">

        {/* ========================================================
            ABA: FATURA DO MÊS
           ======================================================== */}
        {activeTab === 'fatura' && (
          <>
            {/* Cabeçalho */}
            <div>
              <p className="text-xs text-gray-400 font-medium">Organize suas contas 📊</p>
              <h1 className="text-2xl font-black tracking-tight text-white mt-0.5">Fatura do Mês</h1>
            </div>

            {/* Card: Meu Dinheiro Disponível */}
            <div className="bg-[#181820] p-4 rounded-2xl border border-[#232330] flex justify-between items-center">
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold block mb-1">
                  MEU DINHEIRO DISPONÍVEL
                </span>
                <span className="text-2xl font-black text-[#00E676]">
                  R$ {formatBRL(availableMoney)}
                </span>
              </div>
              <button
                onClick={() => {
                  setMoneyInput(formatBRL(availableMoney));
                  setIsEditMoneyOpen(true);
                }}
                className="bg-[#242432] hover:bg-[#2e2e3f] text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1 text-gray-300 border border-[#323246] transition-transform active:scale-95"
              >
                ✏️ Editar
              </button>
            </div>

            {/* Card: Resumo do Mês */}
            <div className="bg-[#141A18] p-4 rounded-2xl border border-[#1C382B] flex flex-col gap-3">
              <h2 className="text-sm font-bold text-gray-200">Resumo do mês</h2>

              <div className="flex flex-col gap-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 flex items-center gap-2">💰 Dinheiro disponível</span>
                  <span className="font-bold text-[#00E676]">R$ {formatBRL(availableMoney)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-300 flex items-center gap-2">📬 A receber</span>
                  <span className="font-bold text-[#00E676]">+ R$ {formatBRL(aReceberTotal)}</span>
                </div>

                <hr className="border-[#21352A] my-0.5" />

                <div className="flex justify-between items-center">
                  <span className="text-gray-300 flex items-center gap-2">💳 Cartão da mãe (mês)</span>
                  <span className="font-bold text-[#FF4081]">- R$ {formatBRL(cartaoMaeTotal)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-300 flex items-center gap-2">💙 Meu cartão</span>
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

            {/* Seção 1: Cartão da Mãe */}
            <div className="bg-[#181820] p-4 rounded-2xl border border-[#232330] flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    💳 Cartão da Mãe
                  </h3>
                  <span className="text-xs text-gray-400">Parcela deste mês: R$ {formatBRL(cartaoMaeTotal)}</span>
                </div>
                <button
                  onClick={() => openAddFaturaItem('mae')}
                  className="w-9 h-9 rounded-xl bg-[#2A1D28] text-[#FF4081] border border-[#3E2337] font-bold text-lg flex items-center justify-center hover:bg-[#382235] active:scale-95 transition-transform"
                >
                  +
                </button>
              </div>

              {/* Lista de Itens */}
              <div className="flex flex-col gap-2 pt-1">
                {faturaItems.filter(i => i.category === 'mae').length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-2">Nenhum item adicionado</p>
                ) : (
                  faturaItems.filter(i => i.category === 'mae').map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-[#111118] p-3 rounded-xl border border-[#232332] text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-gray-100">{item.description}</span>
                        <span className="text-[10px] text-gray-400">
                          Total: R$ {formatBRL(item.total_amount || item.amount)} {item.installments > 1 ? `(${item.installments}x)` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <span className="font-bold text-[#FF4081] block">R$ {formatBRL(item.amount)}</span>
                          {item.installments > 1 && (
                            <span className="text-[9px] text-gray-400 block">/mês</span>
                          )}
                        </div>
                        <button onClick={() => handleDeleteFaturaItem(item.id)} className="text-gray-500 hover:text-red-400 px-1 text-sm">✕</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Seção 2: Meu Cartão */}
            <div className="bg-[#181820] p-4 rounded-2xl border border-[#232330] flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    💙 Meu Cartão
                  </h3>
                  <span className="text-xs text-gray-400">Total: R$ {formatBRL(meuCartaoTotal)}</span>
                </div>
                <button
                  onClick={() => openAddFaturaItem('meu_cartao')}
                  className="w-9 h-9 rounded-xl bg-[#1B2836] text-[#00B0FF] border border-[#1E384D] font-bold text-lg flex items-center justify-center hover:bg-[#203447] active:scale-95 transition-transform"
                >
                  +
                </button>
              </div>

              {/* Lista de Itens */}
              <div className="flex flex-col gap-2 pt-1">
                {faturaItems.filter(i => i.category === 'meu_cartao').length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-2">Nenhum item adicionado</p>
                ) : (
                  faturaItems.filter(i => i.category === 'meu_cartao').map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-[#111118] p-3 rounded-xl border border-[#232332] text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-gray-100">{item.description}</span>
                        <span className="text-[10px] text-gray-400">
                          Total: R$ {formatBRL(item.total_amount || item.amount)} {item.installments > 1 ? `(${item.installments}x)` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <span className="font-bold text-[#00B0FF] block">R$ {formatBRL(item.amount)}</span>
                          {item.installments > 1 && (
                            <span className="text-[9px] text-gray-400 block">/mês</span>
                          )}
                        </div>
                        <button onClick={() => handleDeleteFaturaItem(item.id)} className="text-gray-500 hover:text-red-400 px-1 text-sm">✕</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Seção 3: A Receber */}
            <div className="bg-[#181820] p-4 rounded-2xl border border-[#232330] flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    💰 A Receber
                  </h3>
                  <span className="text-xs text-gray-400">Total: R$ {formatBRL(aReceberTotal)}</span>
                </div>
                <button
                  onClick={() => openAddFaturaItem('a_receber')}
                  className="w-9 h-9 rounded-xl bg-[#1B2D24] text-[#00E676] border border-[#214332] font-bold text-lg flex items-center justify-center hover:bg-[#203B2E] active:scale-95 transition-transform"
                >
                  +
                </button>
              </div>

              {/* Lista de Itens */}
              <div className="flex flex-col gap-2 pt-1">
                {faturaItems.filter(i => i.category === 'a_receber').length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-2">Nenhum item adicionado</p>
                ) : (
                  faturaItems.filter(i => i.category === 'a_receber').map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-[#111118] p-3 rounded-xl border border-[#232332] text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-gray-100">{item.description}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#00E676]">R$ {formatBRL(item.amount)}</span>
                        <button onClick={() => handleDeleteFaturaItem(item.id)} className="text-gray-500 hover:text-red-400 px-1 text-sm">✕</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* ========================================================
            ABA: COMPRAS (SUA LISTA ORIGINAL)
           ======================================================== */}
        {activeTab === 'compras' && (
          <>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-400 font-medium">Boa compra! 🛒</p>
                <h1 className="text-2xl font-extrabold tracking-tight">Minha Lista</h1>
              </div>
              <button
                onClick={() => openShopModal()}
                className="w-12 h-12 bg-[#FF5722] hover:bg-[#e64a19] text-white text-2xl font-bold rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95"
              >
                +
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#1C1C24] p-3 rounded-2xl flex flex-col justify-between border border-[#272732]">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Total</span>
                <span className="text-sm font-bold text-white mt-1">R$ {formatBRL(shopTotalValue)}</span>
              </div>
              <div className="bg-[#1C1C24] p-3 rounded-2xl flex flex-col justify-between border border-[#272732]">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Itens</span>
                <span className="text-sm font-bold text-white mt-1">{shopTotalItemsCount}</span>
              </div>
              <button
                onClick={handleClearShopList}
                className="bg-[#1C1C24] p-3 rounded-2xl flex flex-col justify-center items-center border border-[#272732] hover:bg-red-950/30 transition-colors"
              >
                <span className="text-xs font-bold text-red-500">Limpar</span>
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              {SHOP_CATEGORIES.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setSelectedShopCategory(cat.name)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedShopCategory === cat.name
                      ? 'bg-[#FF5722] text-white'
                      : 'bg-[#1C1C24] text-gray-300 border border-[#272732]'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              {filteredShopItems.length === 0 ? (
                <div className="text-center text-gray-500 py-10 text-sm">Nenhum item encontrado.</div>
              ) : (
                filteredShopItems.map((item) => {
                  const itemTotal = item.price * item.quantity;
                  return (
                    <div
                      key={item.id}
                      className="bg-[#1C1C24] p-4 rounded-2xl flex justify-between items-center border-l-4 border-l-[#00E676] border-y border-r border-[#272732]"
                    >
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
                          <span className="font-bold text-sm text-white">R$ {formatBRL(itemTotal)}</span>
                        </div>

                        <div className="flex gap-1">
                          <button onClick={() => openShopModal(item)} className="w-8 h-8 rounded-full bg-[#272732] text-yellow-400 flex items-center justify-center hover:bg-[#323242] text-xs">✏️</button>
                          <button onClick={() => handleDeleteShopItem(item.id)} className="w-8 h-8 rounded-full bg-[#321C24] text-red-400 flex items-center justify-center hover:bg-[#42222E] text-xs">✕</button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

      </div>

      {/* ========================================================
          BARRA DE NAVEGAÇÃO INFERIOR (APENAS FATURA E COMPRAS)
         ======================================================== */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#121218]/95 backdrop-blur-md border-t border-[#22222E] flex justify-around items-center py-2.5 z-40 max-w-md mx-auto">
        
        {/* Tab 1: Fatura */}
        <button
          onClick={() => setActiveTab('fatura')}
          className="flex flex-col items-center gap-1 relative px-8 py-1"
        >
          {activeTab === 'fatura' && (
            <div className="absolute -top-2.5 w-12 h-1 bg-[#FFB74D] rounded-full" />
          )}
          <span className={`text-xl ${activeTab === 'fatura' ? 'opacity-100 scale-110' : 'opacity-40'} transition-all`}>
            📊
          </span>
          <span className={`text-xs font-bold ${activeTab === 'fatura' ? 'text-[#FFB74D]' : 'text-gray-500'}`}>
            Fatura
          </span>
        </button>

        {/* Tab 2: Compras */}
        <button
          onClick={() => setActiveTab('compras')}
          className="flex flex-col items-center gap-1 relative px-8 py-1"
        >
          {activeTab === 'compras' && (
            <div className="absolute -top-2.5 w-12 h-1 bg-[#FF5722] rounded-full" />
          )}
          <span className={`text-xl ${activeTab === 'compras' ? 'opacity-100 scale-110' : 'opacity-40'} transition-all`}>
            🛒
          </span>
          <span className={`text-xs font-bold ${activeTab === 'compras' ? 'text-[#FF5722]' : 'text-gray-500'}`}>
            Compras
          </span>
        </button>
      </div>

      {/* ========================================================
          MODAIS DA FATURA
         ======================================================== */}
      {/* Modal 1: Editar Dinheiro Disponível */}
      {isEditMoneyOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-[#1C1C24] border border-[#272732] w-full max-w-md rounded-3xl p-6 text-white flex flex-col gap-4">
            <h2 className="text-lg font-bold">Editar Dinheiro Disponível</h2>
            <form onSubmit={handleSaveAvailableMoney} className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Valor Disponível (R$)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="0,00"
                  value={moneyInput}
                  onChange={(e) => setMoneyInput(formatCurrencyInput(e.target.value))}
                  className="w-full bg-[#111116] border border-[#272732] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#00E676]"
                />
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setIsEditMoneyOpen(false)}
                  className="flex-1 bg-[#272732] py-2.5 rounded-xl text-xs font-semibold text-gray-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#00E676] text-black py-2.5 rounded-xl text-xs font-bold hover:bg-[#00c853]"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Adicionar Item na Fatura (COM VALOR TOTAL E PARCELAS) */}
      {isFaturaModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-[#1C1C24] border border-[#272732] w-full max-w-md rounded-3xl p-6 text-white flex flex-col gap-4">
            <h2 className="text-lg font-bold">
              Novo Item em {faturaTargetCategory === 'mae' ? 'Cartão da Mãe' : faturaTargetCategory === 'meu_cartao' ? 'Meu Cartão' : 'A Receber'}
            </h2>
            <form onSubmit={handleSaveFaturaItem} className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Descrição</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Geladeira, Salário, Internet"
                  value={faturaDescription}
                  onChange={(e) => setFaturaDescription(e.target.value)}
                  className="w-full bg-[#111116] border border-[#272732] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#00E676]"
                />
              </div>

              <div className={`grid ${faturaTargetCategory === 'a_receber' ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Valor Total (R$)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="0,00"
                    value={faturaTotalAmountInput}
                    onChange={(e) => setFaturaTotalAmountInput(formatCurrencyInput(e.target.value))}
                    className="w-full bg-[#111116] border border-[#272732] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#00E676]"
                  />
                </div>

                {faturaTargetCategory !== 'a_receber' && (
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Dividir em (x)</label>
                    <input
                      type="number"
                      min="1"
                      max="72"
                      required
                      value={faturaInstallments}
                      onChange={(e) => setFaturaInstallments(e.target.value)}
                      className="w-full bg-[#111116] border border-[#272732] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#00E676]"
                    />
                  </div>
                )}
              </div>

              {/* Prévia da Parcela se for mais de 1x */}
              {faturaTargetCategory !== 'a_receber' && Number(faturaInstallments) > 1 && (
                <div className="bg-[#111116] p-2.5 rounded-xl border border-[#272732] text-xs text-gray-300 flex justify-between items-center">
                  <span>Valor mensal:</span>
                  <span className="font-bold text-[#00E676]">
                    {faturaInstallments}x de R${' '}
                    {formatBRL(
                      (parseFloat(faturaTotalAmountInput.replace(/\./g, '').replace(',', '.')) || 0) /
                        (parseInt(faturaInstallments) || 1)
                    )}
                  </span>
                </div>
              )}

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setIsFaturaModalOpen(false)}
                  className="flex-1 bg-[#272732] py-2.5 rounded-xl text-xs font-semibold text-gray-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#00E676] text-black py-2.5 rounded-xl text-xs font-bold hover:bg-[#00c853]"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL DA COMPRA (ORIGINAL)
         ======================================================== */}
      {isShopModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-[#1C1C24] border border-[#272732] w-full max-w-md rounded-3xl p-6 text-white flex flex-col gap-4">
            <h2 className="text-lg font-bold">{editingShopItem ? 'Editar Item' : 'Novo Item'}</h2>
            
            <form onSubmit={handleSaveShopItem} className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Nome do Produto</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Arroz, Sabão em pó"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full bg-[#111116] border border-[#272732] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FF5722]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={shopQuantity}
                    onChange={(e) => setShopQuantity(e.target.value)}
                    className="w-full bg-[#111116] border border-[#272732] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FF5722]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Valor Unitário (R$)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={shopPrice}
                    onChange={(e) => setShopPrice(formatCurrencyInput(e.target.value))}
                    className="w-full bg-[#111116] border border-[#272732] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FF5722]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Categoria</label>
                <select
                  value={shopCategory}
                  onChange={(e) => setShopCategory(e.target.value)}
                  className="w-full bg-[#111116] border border-[#272732] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FF5722]"
                >
                  {SHOP_CATEGORIES.filter((c) => c.name !== 'Todos').map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setIsShopModalOpen(false)}
                  className="flex-1 bg-[#272732] py-2.5 rounded-xl text-xs font-semibold text-gray-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#FF5722] py-2.5 rounded-xl text-xs font-semibold text-white hover:bg-[#e64a19]"
                >
                  {editingShopItem ? 'Atualizar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}