import { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Animated, KeyboardAvoidingView,
  Platform, ScrollView, SafeAreaView, Dimensions, Alert,
} from "react-native";
import { supabase } from "./supabase"; // Importação do cliente Supabase
import { CORES } from "./theme";

const { width } = Dimensions.get("window");

const CATEGORIAS = [
  { id: "todos",      label: "Todos",      emoji: "✦",  cor: CORES.primaria },
  { id: "hortifruti", label: "Comidas",    emoji: "🍔", cor: CORES.hortifruti },
  { id: "limpeza",    label: "Limpeza",    emoji: "🧼", cor: CORES.limpeza },
  { id: "higiene",    label: "Higiene",    emoji: "🪥", cor: CORES.higiene },
  { id: "bebidas",    label: "Bebidas",    emoji: "🧃", cor: CORES.bebidas },
  { id: "outros",     label: "Outros",     emoji: "📦", cor: CORES.outros },
];

const formatBRL = (v) =>
  (parseFloat(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ItemLista({ item, onToggle, onRemover, onEditar }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const cat = CATEGORIAS.find(c => c.id === item.categoria) || CATEGORIAS[CATEGORIAS.length - 1];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  const totalItem = (parseFloat(item.valor) || 0) * (parseInt(item.quantidade) || 1);

  return (
    <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }, item.comprado && s.cardComprado]}>
      <TouchableOpacity 
        style={[s.cardAccent, { backgroundColor: item.comprado ? CORES.textoClaro : cat.cor }]} 
        onPress={() => onToggle(item.id, item.comprado)}
        activeOpacity={0.8}
      />
      
      <TouchableOpacity style={{ flex: 1, gap: 3 }} onPress={() => onToggle(item.id, item.comprado)} activeOpacity={0.8}>
        <Text style={[s.itemNome, item.comprado && s.itemNomeComprado]} numberOfLines={1}>
          {item.quantidade > 1 ? `${item.quantidade}x ` : ""}{item.nome}
        </Text>
        <View style={[s.catTag, { backgroundColor: cat.cor + "20" }]}>
          <Text style={{ fontSize: 10 }}>{cat.emoji}</Text>
          <Text style={[s.catTagTexto, { color: cat.cor }]}>{cat.label}</Text>
        </View>
      </TouchableOpacity>

      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <Text style={[s.itemValor, item.comprado && { color: CORES.textoClaro }]}>{formatBRL(totalItem)}</Text>
        
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity onPress={() => onEditar(item)} style={s.btnEditar} activeOpacity={0.7}>
            <Text style={s.btnEditarTexto}>✏️</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => onRemover(item.id)} style={s.btnExcluir} activeOpacity={0.7}>
            <Text style={s.btnExcluirTexto}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

function TelaFormularioItem({ voltar, itemParaEditar }) {
  const [nome, setNome] = useState(itemParaEditar?.nome || "");
  const [valor, setValor] = useState(itemParaEditar?.valor?.toString() || "");
  const [quantidade, setQuantidade] = useState(itemParaEditar?.quantidade?.toString() || "1");
  const [categoria, setCategoria] = useState(itemParaEditar?.categoria || "outros");
  const [erroNome, setErroNome] = useState(false);
  
  const catSel = CATEGORIAS.find(c => c.id === categoria);

  const salvar = async () => {
    if (!nome.trim()) { setErroNome(true); return; }
    try {
      const valorFormatado = parseFloat(valor.replace(",", ".")) || 0;
      const qtdFormatada = parseInt(quantidade) || 1;

      if (itemParaEditar) {
        // Atualiza item existente no Supabase
        const { error } = await supabase
          .from('compras')
          .update({ 
            nome: nome.trim(), 
            valor: valorFormatado, 
            quantidade: qtdFormatada, 
            categoria 
          })
          .eq('id', itemParaEditar.id);

        if (error) throw error;
      } else {
        // Insere novo item no Supabase
        const { error } = await supabase
          .from('compras')
          .insert([{ 
            nome: nome.trim(), 
            valor: valorFormatado, 
            quantidade: qtdFormatada, 
            categoria, 
            comprado: false 
          }]);

        if (error) throw error;
      }

      voltar();
    } catch (e) {
      console.log("Erro ao salvar no Supabase:", e);
      Alert.alert("Erro", "Não foi possível salvar o item.");
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.subHeader}>
        <TouchableOpacity onPress={voltar} style={s.btnVoltar}>
          <Text style={s.btnVoltarTexto}>← Cancelar</Text>
        </TouchableOpacity>
        <Text style={s.subHeaderTitulo}>{itemParaEditar ? "Editar Item" : "Novo Item"}</Text>
        <View style={{ width: 70 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.formScroll}>
          <Text style={s.label}>Nome</Text>
          <TextInput style={[s.input, erroNome && s.inputErro]} value={nome} onChangeText={t => { setNome(t); setErroNome(false); }} placeholder="Ex: Arroz" placeholderTextColor={CORES.textoClaro} />

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1.5 }}>
              <Text style={s.label}>Valor Unitário</Text>
              <View style={s.inputRow}>
                <Text style={s.inputPrefix}>R$</Text>
                <TextInput style={[s.input, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeftWidth: 0 }]} value={valor} onChangeText={t => setValor(t.replace(/[^0-9.,]/g, ""))} keyboardType="decimal-pad" placeholder="0,00" />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Qtd.</Text>
              <TextInput style={s.input} value={quantidade} onChangeText={t => setQuantidade(t.replace(/[^0-9]/g, ""))} keyboardType="number-pad" />
            </View>
          </View>

          <Text style={s.label}>Categoria</Text>
          <View style={s.catGrid}>
            {CATEGORIAS.filter(c => c.id !== "todos").map(cat => (
              <TouchableOpacity key={cat.id} style={[s.catOpcao, categoria === cat.id && { borderColor: cat.cor, backgroundColor: cat.cor + "15" }]} onPress={() => setCategoria(cat.id)}>
                <Text style={{ fontSize: 22 }}>{cat.emoji}</Text>
                <Text style={[s.catOpcaoTexto, categoria === cat.id && { color: cat.cor }]}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={[s.btnSalvar, { backgroundColor: catSel.cor }]} onPress={salvar}>
            <Text style={s.btnSalvarTexto}>{itemParaEditar ? "Salvar Alterações" : "Adicionar"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function TelaCompras() {
  const [itens, setItens] = useState([]);
  const [catFiltro, setCatFiltro] = useState("todos");
  const [exibirForm, setExibirForm] = useState(false);
  const [itemSendoEditado, setItemSendoEditado] = useState(null);

  useEffect(() => { carregarItens(); }, []);

  // Busca os dados diretamente do Supabase ordenados por data de criação decrescente
  const carregarItens = async () => {
    try {
      const { data, error } = await supabase
        .from('compras')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;
      if (data) setItens(data);
    } catch (e) {
      console.log("Erro ao carregar do Supabase:", e);
    }
  };

  const abrirEdicao = (item) => {
    setItemSendoEditado(item);
    setExibirForm(true);
  };

  const toggle = async (id, statusAtual) => {
    // Atualização otimista na tela para dar resposta imediata
    setItens(itens.map(i => i.id === id ? { ...i, comprado: !statusAtual } : i));

    try {
      const { error } = await supabase
        .from('compras')
        .update({ comprado: !statusAtual })
        .eq('id', id);

      if (error) throw error;
    } catch (e) {
      console.log("Erro ao atualizar status:", e);
      carregarItens(); // Reverte se falhar
    }
  };

  const remover = async (id) => {
    // Remoção otimista na tela
    setItens(itens.filter(i => i.id !== id));

    try {
      const { error } = await supabase
        .from('compras')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (e) {
      console.log("Erro ao excluir item:", e);
      carregarItens(); // Reverte se falhar
    }
  };

  const confirmarLimpeza = () => {
    if (itens.length === 0) return;

    Alert.alert(
      "Limpar Lista",
      "Deseja apagar todos os itens da sua Lista de Compras?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Confirmar", 
          style: "destructive", 
          onPress: async () => {
            setItens([]);
            try {
              // Apaga todos os registros da tabela compras no Supabase
              const { error } = await supabase
                .from('compras')
                .delete()
                .neq('id', 0); // Deleta tudo onde o ID é diferente de zero

              if (error) throw error;
            } catch (e) {
              console.log("Erro ao limpar lista:", e);
              carregarItens();
            }
          } 
        }
      ]
    );
  };

  if (exibirForm) return <TelaFormularioItem itemParaEditar={itemSendoEditado} voltar={() => { setExibirForm(false); setItemSendoEditado(null); carregarItens(); }} />;

  const filtrados = catFiltro === "todos" ? itens : itens.filter(i => i.categoria === catFiltro);
  const totalGeral = itens.reduce((s, i) => s + (parseFloat(i.valor) * (parseInt(i.quantidade) || 1)), 0);

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerSub}>Boa compra! 🛒</Text>
            <Text style={s.headerTitulo}>Minha Lista</Text>
          </View>
          
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={s.fabAdd} onPress={() => setExibirForm(true)}>
              <Text style={s.fabAddTexto}>＋</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.statsRow}>
          <View style={s.statCard}><Text style={s.statLabel}>Total</Text><Text style={s.statValor}>{formatBRL(totalGeral)}</Text></View>
          <View style={[s.statCard, { flex: 0.6 }]}><Text style={s.statLabel}>Itens</Text><Text style={s.statValor}>{itens.filter(i => !i.comprado).length}/{itens.length}</Text></View>
          {itens.length > 0 && (
              <TouchableOpacity style={s.btnLimpar} onPress={confirmarLimpeza}>
                <Text style={s.btnLimparTexto}>Limpar</Text>
              </TouchableOpacity>
            )}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pillsScroll} contentContainerStyle={s.pillsContent}>
        {CATEGORIAS.map(cat => (
          <TouchableOpacity key={cat.id} style={[s.pill, catFiltro === cat.id ? { backgroundColor: cat.cor, borderColor: cat.cor } : { backgroundColor: CORES.fundoElevado, borderColor: CORES.borda }]} onPress={() => setCatFiltro(cat.id)}>
            <Text>{cat.emoji} <Text style={[s.pillTexto, catFiltro === cat.id && { color: "#000" }]}>{cat.label}</Text></Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList data={filtrados} keyExtractor={i => i.id.toString()} contentContainerStyle={s.lista}
        renderItem={({ item }) => <ItemLista item={item} onToggle={toggle} onRemover={remover} onEditar={abrirEdicao} />}
        ListEmptyComponent={<View style={s.vazio}><Text style={s.vazioEmoji}>🛒</Text><Text style={s.vazioTexto}>Lista vazia</Text></View>}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:          { flex: 1, backgroundColor: CORES.fundo },
  header:             { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, flexShrink: 0 },
  headerRow:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  headerSub:          { color: CORES.textoMedio, fontSize: 13 },
  headerTitulo:       { color: CORES.textoEscuro, fontSize: 26, fontWeight: "800" },
  btnLimpar:          { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: CORES.fundoElevado, borderWidth: 1, borderColor: CORES.borda, justifyContent: 'center' },
  btnLimparTexto:     { color: CORES.erro, fontSize: 12, fontWeight: "700" },
  fabAdd:             { width: 46, height: 46, borderRadius: 23, backgroundColor: CORES.primaria, alignItems: "center", justifyContent: "center" },
  fabAddTexto:        { color: "#fff", fontSize: 24 },
  statsRow:           { flexDirection: "row", gap: 8, marginBottom: 14 },
  statCard:           { flex: 1, backgroundColor: CORES.fundoCard, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: CORES.borda },
  statLabel:          { color: CORES.textoClaro, fontSize: 11, textTransform: "uppercase" },
  statValor:          { color: CORES.textoEscuro, fontSize: 15, fontWeight: "800" },
  pillsScroll:        { maxHeight: 55, flexShrink: 0, borderTopWidth: 1, borderBottomWidth: 1, borderColor: CORES.borda },
  pillsContent:       { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  pill:               { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  pillTexto:          { fontSize: 13, color: CORES.textoMedio, fontWeight: "500" },
  lista:              { flexGrow: 1, padding: 16, gap: 10, paddingBottom: 100 },
  card:               { flexDirection: "row", alignItems: "center", backgroundColor: CORES.fundoCard, borderRadius: 16, padding: 14, gap: 12, borderWidth: 1, borderColor: CORES.borda, overflow: "hidden" },
  cardComprado:       { opacity: 0.5 },
  cardAccent:         { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  itemNome:           { fontSize: 15, color: CORES.textoEscuro, fontWeight: "600" },
  itemNomeComprado:   { color: CORES.textoClaro, textDecorationLine: "line-through" },
  catTag:             { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start" },
  catTagTexto:        { fontSize: 11, fontWeight: "600" },
  itemValor:          { fontSize: 15, fontWeight: "800", color: CORES.textoEscuro },
  btnEditar:          { width: 32, height: 32, backgroundColor: CORES.fundoElevado, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: CORES.borda, overflow: "hidden" },
  btnEditarTexto:     { fontSize: 14 },
  btnExcluir:         { width: 32, height: 32, backgroundColor: CORES.erroClaro, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: CORES.erroBorda, overflow: "hidden" },
  btnExcluirTexto:    { color: CORES.erro, fontSize: 12, fontWeight: "700" },
  vazio:              { alignItems: "center", paddingTop: 80 },
  vazioEmoji:         { fontSize: 48 },
  vazioTexto:         { fontSize: 18, color: CORES.textoMedio, fontWeight: "700" },
  formScroll:         { padding: 20, paddingBottom: 50 },
  label:              { fontSize: 11, fontWeight: "700", color: CORES.textoMedio, marginTop: 20, textTransform: "uppercase" },
  input:              { backgroundColor: CORES.fundoCard, borderRadius: 14, padding: 14, fontSize: 16, color: CORES.textoEscuro, borderWidth: 1.5, borderColor: CORES.borda },
  inputErro:          { borderColor: CORES.erro },
  inputRow:           { flexDirection: "row", alignItems: "center" },
  inputPrefix:        { backgroundColor: CORES.fundoElevado, padding: 14, color: CORES.textoMedio, borderWidth: 1.5, borderColor: CORES.borda, borderRightWidth: 0, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
  catGrid:            { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  catOpcao:           { width: (width - 60) / 3, alignItems: "center", padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: CORES.borda },
  catOpcaoTexto:      { fontSize: 12, color: CORES.textoMedio },
  btnSalvar:          { borderRadius: 16, padding: 17, alignItems: "center", marginTop: 28 },
  btnSalvarTexto:     { color: "#000", fontSize: 16, fontWeight: "800" },
  subHeader:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 },
  btnVoltar:          { backgroundColor: CORES.fundoElevado, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  btnVoltarTexto:     { color: CORES.textoMedio, fontSize: 13 },
  subHeaderTitulo:    { color: CORES.textoEscuro, fontSize: 17, fontWeight: "700" },
});