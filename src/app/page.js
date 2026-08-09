'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Inicialize com suas credenciais do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://abopaplifnrruoxjfrgn.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFib3BhcGxpZm5ycnVveGpmcmduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMTU1MDksImV4cCI6MjEwMTY5MTUwOX0.LPw0TfRUhpbm7VwmfdJTIhvfDbFM6SDO8TONh-l19qA';
const supabase = createClient(supabaseUrl, supabaseKey);

const CATEGORIES = [
  { name: 'Todos', icon: '✨' },
  { name: 'Comidas', icon: '🍔' },
  { name: 'Limpeza', icon: '🧼' },
  { name: 'Higiene', icon: '🪥' },
  { name: 'Outros', icon: '📦' },
];

// Função utilitária para aplicar a máscara de moeda (ex: 1250 -> "12,50")
const formatCurrency = (value) => {
  const digitsOnly = value.replace(/\D/g, '');
  if (!digitsOnly) return '';
  const numberValue = parseFloat(digitsOnly) / 100;
  return numberValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function App() {
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Comidas');

  // Buscar itens e assinar mudanças em tempo real (Realtime)
  useEffect(() => {
    fetchItems();

    const channel = supabase
      .channel('realtime-items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
        fetchItems();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchItems = async () => {
    const { data, error } = await supabase.from('items').select('*').order('created_at', { ascending: true });
    if (!error && data) setItems(data);
  };

  // Handler para digitar o valor formatado em tempo real
  const handlePriceChange = (e) => {
    setPrice(formatCurrency(e.target.value));
  };

  // Abrir modal para Adicionar ou Editar
  const openModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setName(item.name);
      setQuantity(item.quantity);
      // Formata o número vindo do banco (ex: 12.5 -> "12,50")
      setPrice(
        item.price
          ? item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : ''
      );
      setCategory(item.category);
    } else {
      setEditingItem(null);
      setName('');
      setQuantity(1);
      setPrice('');
      setCategory('Comidas');
    }
    setIsModalOpen(true);
  };

  // Salvar Item (Criar ou Atualizar)
  const handleSave = async (e) => {
    e.preventDefault();
    // Converte "12,50" ou "1.250,50" para o número float (12.50 ou 1250.50)
    const numericPrice = parseFloat(price.replace(/\./g, '').replace(',', '.')) || 0;

    if (editingItem) {
      await supabase
        .from('items')
        .update({ name, quantity: Number(quantity), price: numericPrice, category })
        .eq('id', editingItem.id);
    } else {
      await supabase.from('items').insert([{ name, quantity: Number(quantity), price: numericPrice, category }]);
    }

    setIsModalOpen(false);
  };

  // Excluir Item Único
  const handleDelete = async (id) => {
    await supabase.from('items').delete().eq('id', id);
  };

  // Limpar Toda a Lista
  const handleClearAll = async () => {
    if (confirm('Tem certeza que deseja apagar toda a lista de compras?')) {
      await supabase.from('items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
  };

  // Cálculos de Totais
  const totalValue = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const totalItemsCount = items.reduce((acc, item) => acc + item.quantity, 0);

  // Filtragem
  const filteredItems = selectedCategory === 'Todos' 
    ? items 
    : items.filter(item => item.category === selectedCategory);

  return (
    <div className="min-h-screen bg-[#111116] text-white flex justify-center pb-20 font-sans">
      <div className="w-full max-w-md px-4 pt-6 flex flex-col gap-5">
        
        {/* Cabeçalho */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-400 font-medium">Boa compra! 🛒</p>
            <h1 className="text-2xl font-extrabold tracking-tight">Minha Lista</h1>
          </div>
          <button
            onClick={() => openModal()}
            className="w-12 h-12 bg-[#FF5722] hover:bg-[#e64a19] text-white text-2xl font-bold rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95"
          >
            +
          </button>
        </div>

        {/* Cards de Métricas e Ações */}
        <div className="grid grid-cols-3 gap-3">
          {/* Valor Total */}
          <div className="bg-[#1C1C24] p-3 rounded-2xl flex flex-col justify-between border border-[#272732]">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Total</span>
            <span className="text-sm font-bold text-white mt-1">
              R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Quantidade de Itens */}
          <div className="bg-[#1C1C24] p-3 rounded-2xl flex flex-col justify-between border border-[#272732]">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Itens</span>
            <span className="text-sm font-bold text-white mt-1">{totalItemsCount}</span>
          </div>

          {/* Botão de Apagar Lista */}
          <button
            onClick={handleClearAll}
            className="bg-[#1C1C24] p-3 rounded-2xl flex flex-col justify-center items-center border border-[#272732] hover:bg-red-950/30 transition-colors"
          >
            <span className="text-xs font-bold text-red-500">Limpar</span>
          </button>
        </div>

        {/* Categorias (Filtro Horizontal) */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.name
                  ? 'bg-[#FF5722] text-white'
                  : 'bg-[#1C1C24] text-gray-300 border border-[#272732]'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Lista de Produtos */}
        <div className="flex flex-col gap-3">
          {filteredItems.length === 0 ? (
            <div className="text-center text-gray-500 py-10 text-sm">Nenhum item encontrado.</div>
          ) : (
            filteredItems.map((item) => {
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
                        {CATEGORIES.find((c) => c.name === item.category)?.icon || '📦'} {item.category}
                      </span>
                      <span className="text-xs text-gray-400 font-medium">x{item.quantity}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs text-gray-400 block">Total</span>
                      <span className="font-bold text-sm text-white">
                        R$ {itemTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex gap-1">
                      {/* Editar */}
                      <button
                        onClick={() => openModal(item)}
                        className="w-8 h-8 rounded-full bg-[#272732] text-yellow-400 flex items-center justify-center hover:bg-[#323242] text-xs"
                      >
                        ✏️
                      </button>

                      {/* Excluir */}
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="w-8 h-8 rounded-full bg-[#321C24] text-red-400 flex items-center justify-center hover:bg-[#42222E] text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* Modal para Adicionar / Editar Item */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-[#1C1C24] border border-[#272732] w-full max-w-md rounded-3xl p-6 text-white flex flex-col gap-4">
            <h2 className="text-lg font-bold">{editingItem ? 'Editar Item' : 'Novo Item'}</h2>
            
            <form onSubmit={handleSave} className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Nome do Produto</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Arroz, Sabão em pó"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full bg-[#111116] border border-[#272732] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FF5722]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Valor Unitário (R$)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={price}
                    onChange={handlePriceChange}
                    className="w-full bg-[#111116] border border-[#272732] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FF5722]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Categoria</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#111116] border border-[#272732] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FF5722]"
                >
                  {CATEGORIES.filter((c) => c.name !== 'Todos').map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-[#272732] py-2.5 rounded-xl text-xs font-semibold text-gray-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#FF5722] py-2.5 rounded-xl text-xs font-semibold text-white hover:bg-[#e64a19]"
                >
                  {editingItem ? 'Atualizar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}