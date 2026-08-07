import { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, SafeAreaView, Animated,
  Alert, Platform, KeyboardAvoidingView, Keyboard,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CORES } from "./theme";

const STORAGE_KEY = "@faturas_v1";
const formatBRL = (v) => (parseFloat(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ─── Modal de adição ──────────────────────────────────────
function ModalAdicionar({ tipo, onSalvar, onFechar }) {
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [parcelas, setParcelas] = useState("1");
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, tension: 55, friction: 12, useNativeDriver: true }).start();
  }, []);

  const fechar = () => {
    Keyboard.dismiss();
    Animated.timing(slideAnim, { toValue: 600, duration: 220, useNativeDriver: true }).start(onFechar);
  };

  const salvar = () => {
    if (!nome.trim() || !valor) return;
    onSalvar({
      id: Date.now().toString(),
      nome: nome.trim(),
      valor: valor.replace(",", "."),
      parcelas: tipo === "mae" ? (parseInt(parcelas) || 1) : 1,
      criadoEm: new Date().toISOString(),
    });
    fechar();
  };

  const configs = {
    mae:     { titulo: "Cartão da Mãe", cor: CORES.higiene,  emoji: "💳" },
    meu:     { titulo: "Meu Cartão",    cor: CORES.abaCalc,  emoji: "💙" },
    receber: { titulo: "A Receber",     cor: CORES.sucesso,  emoji: "💰" },
  };
  const cfg = configs[tipo];
  const valorNum = parseFloat(valor.replace(",", ".")) || 0;
  const parcelasNum = parseInt(parcelas) || 1;

  return (
    <View style={ms.overlay}>
      {/* Toque fora fecha */}
      <TouchableOpacity style={ms.backdrop} onPress={fechar} activeOpacity={1} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "position" : "height"}
        keyboardVerticalOffset={0}
        style={ms.kavContainer}
      >
        <Animated.View style={[ms.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={ms.handle} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            {/* Título */}
            <View style={ms.sheetHeader}>
              <Text style={ms.sheetEmoji}>{cfg.emoji}</Text>
              <Text style={ms.sheetTitulo}>{cfg.titulo}</Text>
            </View>

            {/* Nome */}
            <Text style={ms.label}>Descrição</Text>
            <TextInput
              style={ms.input}
              placeholder="Ex: Netflix, mercado, roupa..."
              placeholderTextColor={CORES.textoClaro}
              value={nome}
              onChangeText={setNome}
              returnKeyType="next"
              selectionColor={cfg.cor}
            />

            {/* Valor */}
            <Text style={ms.label}>Valor total do item</Text>
            <View style={ms.inputRow}>
              <Text style={ms.inputPrefix}>R$</Text>
              <TextInput
                style={[ms.input, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeftWidth: 0 }]}
                placeholder="0,00"
                placeholderTextColor={CORES.textoClaro}
                value={valor}
                onChangeText={t => setValor(t.replace(/[^0-9.,]/g, ""))}
                keyboardType="decimal-pad"
                returnKeyType="done"
                onSubmitEditing={tipo !== "mae" ? salvar : undefined}
                selectionColor={cfg.cor}
              />
            </View>

            {/* Parcelas — só para cartão da mãe */}
            {tipo === "mae" && (
              <>
                <Text style={ms.label}>Número de parcelas</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }} keyboardShouldPersistTaps="handled">
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                    <TouchableOpacity
                      key={n}
                      style={[ms.parcelaPill, parcelas === String(n) && { backgroundColor: cfg.cor, borderColor: cfg.cor }]}
                      onPress={() => setParcelas(String(n))}
                      activeOpacity={0.8}
                    >
                      <Text style={[ms.parcelaPillTexto, parcelas === String(n) && { color: "#0F0F14" }]}>
                        {n === 1 ? "À vista" : `${n}x`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {valorNum > 0 && (
                  <View style={[ms.previewParcela, { borderColor: cfg.cor + "50" }]}>
                    <Text style={ms.previewParcelaLabel}>Parcela deste mês</Text>
                    <Text style={[ms.previewParcelaValor, { color: cfg.cor }]}>
                      {formatBRL(valorNum / parcelasNum)}
                      <Text style={{ fontSize: 13, fontWeight: "400", color: CORES.textoMedio }}> /mês</Text>
                    </Text>
                    {parcelasNum > 1 && (
                      <Text style={ms.previewParcelaSub}>
                        Total {formatBRL(valorNum)} em {parcelasNum}x
                      </Text>
                    )}
                  </View>
                )}
              </>
            )}

            {/* Botões */}
            <View style={ms.botoesRow}>
              <TouchableOpacity style={ms.btnCancelar} onPress={fechar} activeOpacity={0.8}>
                <Text style={ms.btnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ms.btnSalvar, { backgroundColor: cfg.cor }, (!nome.trim() || !valor) && { opacity: 0.4 }]}
                onPress={salvar}
                disabled={!nome.trim() || !valor}
                activeOpacity={0.85}
              >
                <Text style={ms.btnSalvarTexto}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Card de item ─────────────────────────────────────────
function CardItem({ item, cor, onRemover, mostrarParcelas }) {
  const valorMensal = item.valor / (item.parcelas || 1);
  return (
    <View style={[ci.card, { borderLeftColor: cor }]}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={ci.nome} numberOfLines={1}>{item.nome}</Text>
        {mostrarParcelas && item.parcelas > 1 && (
          <Text style={ci.sub}>{item.parcelas}x de {formatBRL(valorMensal)}</Text>
        )}
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <Text style={[ci.valor, { color: cor }]}>
          {formatBRL(mostrarParcelas ? valorMensal : item.valor)}
        </Text>
        {mostrarParcelas && item.parcelas > 1 && (
          <Text style={ci.totalSub}>Total {formatBRL(item.valor)}</Text>
        )}
      </View>
      <TouchableOpacity onPress={() => onRemover(item.id)} style={ci.btnX} activeOpacity={0.7}>
        <Text style={ci.btnXTexto}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Tela principal ───────────────────────────────────────
export default function TelaFatura() {
  const [dados, setDados] = useState({ saldo: "", itensMae: [], itensMeu: [], itensReceber: [] });
  const [editandoSaldo, setEditandoSaldo] = useState(false);
  const [saldoTexto, setSaldoTexto] = useState("");
  const [modalTipo, setModalTipo] = useState(null);

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (json) { const d = JSON.parse(json); setDados(d); setSaldoTexto(d.saldo || ""); }
    } catch {}
  };

  const salvar = async (novosDados) => {
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(novosDados)); } catch {}
  };

  const salvarSaldo = () => {
    const novos = { ...dados, saldo: saldoTexto.replace(",", ".") };
    setDados(novos); salvar(novos); setEditandoSaldo(false); Keyboard.dismiss();
  };

  const adicionarItem = (tipo, item) => {
    const chave = tipo === "mae" ? "itensMae" : tipo === "meu" ? "itensMeu" : "itensReceber";
    const novos = { ...dados, [chave]: [item, ...dados[chave]] };
    setDados(novos); salvar(novos);
  };

  const removerItem = (tipo, id) => {
    const chave = tipo === "mae" ? "itensMae" : tipo === "meu" ? "itensMeu" : "itensReceber";
    const novos = { ...dados, [chave]: dados[chave].filter(i => i.id !== id) };
    setDados(novos); salvar(novos);
  };

  const saldo        = parseFloat(dados.saldo) || 0;
  const totalMae     = dados.itensMae.reduce((s, i) => s + (parseFloat(i.valor) || 0) / (i.parcelas || 1), 0);
  const totalMeu     = dados.itensMeu.reduce((s, i) => s + (parseFloat(i.valor) || 0), 0);
  const totalReceber = dados.itensReceber.reduce((s, i) => s + (parseFloat(i.valor) || 0), 0);
  const totalGastos  = totalMae + totalMeu;
  const saldoFinal   = saldo + totalReceber - totalGastos;
  const positivo     = saldoFinal >= 0;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerSub}>Organize suas contas 📊</Text>
        <Text style={s.headerTitulo}>Fatura do Mês</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Saldo */}
          <View style={s.saldoCard}>
            <View style={s.saldoTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.saldoLabel}>Meu dinheiro disponível</Text>
                {editandoSaldo ? (
                  <View style={s.saldoInputRow}>
                    <Text style={s.saldoPrefix}>R$</Text>
                    <TextInput
                      style={s.saldoInput}
                      value={saldoTexto}
                      onChangeText={t => setSaldoTexto(t.replace(/[^0-9.,]/g, ""))}
                      keyboardType="decimal-pad"
                      autoFocus
                      selectionColor={CORES.sucesso}
                      onSubmitEditing={salvarSaldo}
                      returnKeyType="done"
                    />
                  </View>
                ) : (
                  <Text style={[s.saldoValor, { color: CORES.sucesso }]}>{formatBRL(saldo)}</Text>
                )}
              </View>
              <TouchableOpacity
                style={[s.btnEditarSaldo, editandoSaldo && { backgroundColor: CORES.sucesso }]}
                onPress={editandoSaldo ? salvarSaldo : () => setEditandoSaldo(true)}
                activeOpacity={0.8}
              >
                <Text style={[s.btnEditarSaldoTexto, editandoSaldo && { color: "#0F0F14" }]}>
                  {editandoSaldo ? "✓ Salvar" : "✏ Editar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Resumo */}
          <View style={[s.resumoCard, { borderColor: positivo ? CORES.sucesso + "50" : CORES.erro + "50" }]}>
            <Text style={s.resumoTitulo}>Resumo do mês</Text>
            <View style={s.resumoLinha}>
              <Text style={s.resumoLabel}>💰 Dinheiro disponível</Text>
              <Text style={[s.resumoValor, { color: CORES.sucesso }]}>{formatBRL(saldo)}</Text>
            </View>
            <View style={s.resumoLinha}>
              <Text style={s.resumoLabel}>📥 A receber</Text>
              <Text style={[s.resumoValor, { color: CORES.sucesso }]}>+ {formatBRL(totalReceber)}</Text>
            </View>
            <View style={s.resumoDivisor} />
            <View style={s.resumoLinha}>
              <Text style={s.resumoLabel}>💳 Cartão da mãe (mês)</Text>
              <Text style={[s.resumoValor, { color: CORES.higiene }]}>- {formatBRL(totalMae)}</Text>
            </View>
            <View style={s.resumoLinha}>
              <Text style={s.resumoLabel}>💙 Meu cartão</Text>
              <Text style={[s.resumoValor, { color: CORES.abaCalc }]}>- {formatBRL(totalMeu)}</Text>
            </View>
            <View style={s.resumoDivisor} />
            <View style={s.resumoLinha}>
              <Text style={s.resumoLabelFinal}>Saldo final</Text>
              <Text style={[s.resumoValorFinal, { color: positivo ? CORES.sucesso : CORES.erro }]}>
                {formatBRL(Math.abs(saldoFinal))}{!positivo ? " falta" : ""}
              </Text>
            </View>
            {!positivo && (
              <View style={s.alertaFalta}>
                <Text style={s.alertaTexto}>⚠ Gastos superam o saldo em {formatBRL(Math.abs(saldoFinal))}</Text>
              </View>
            )}
          </View>

          {/* Cartão da mãe */}
          <Secao
            emoji="💳" titulo="Cartão da Mãe" cor={CORES.higiene}
            sub={`Parcela deste mês: ${formatBRL(totalMae)}`}
            itens={dados.itensMae} onAdd={() => setModalTipo("mae")}
            onRemover={id => removerItem("mae", id)} mostrarParcelas
          />

          {/* Meu cartão */}
          <Secao
            emoji="💙" titulo="Meu Cartão" cor={CORES.abaCalc}
            sub={`Total: ${formatBRL(totalMeu)}`}
            itens={dados.itensMeu} onAdd={() => setModalTipo("meu")}
            onRemover={id => removerItem("meu", id)} mostrarParcelas={false}
          />

          {/* A receber */}
          <Secao
            emoji="💰" titulo="A Receber" cor={CORES.sucesso}
            sub={`Total: ${formatBRL(totalReceber)}`}
            itens={dados.itensReceber} onAdd={() => setModalTipo("receber")}
            onRemover={id => removerItem("receber", id)} mostrarParcelas={false}
          />

          {/* Limpar */}
          <TouchableOpacity
            style={s.btnLimpar}
            onPress={() => Alert.alert("Limpar tudo?", "Vai resetar todos os dados do mês.", [
              { text: "Cancelar", style: "cancel" },
              { text: "Limpar", style: "destructive", onPress: () => {
                const novo = { saldo: "", itensMae: [], itensMeu: [], itensReceber: [] };
                setDados(novo); setSaldoTexto(""); salvar(novo);
              }}
            ])}
            activeOpacity={0.8}
          >
            <Text style={s.btnLimparTexto}>🗑 Limpar tudo e começar novo mês</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {modalTipo && (
        <ModalAdicionar
          tipo={modalTipo}
          onSalvar={item => adicionarItem(modalTipo, item)}
          onFechar={() => setModalTipo(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Componente de seção ──────────────────────────────────
function Secao({ emoji, titulo, cor, sub, itens, onAdd, onRemover, mostrarParcelas }) {
  return (
    <View style={s.secaoCard}>
      <View style={s.secaoHeader}>
        <View style={s.secaoTituloRow}>
          <Text style={s.secaoEmoji}>{emoji}</Text>
          <View>
            <Text style={s.secaoTitulo}>{titulo}</Text>
            <Text style={s.secaoSub}>{sub}</Text>
          </View>
        </View>
        <TouchableOpacity style={[s.btnAdd, { backgroundColor: cor + "20", borderColor: cor + "40" }]} onPress={onAdd} activeOpacity={0.8}>
          <Text style={[s.btnAddTexto, { color: cor }]}>＋</Text>
        </TouchableOpacity>
      </View>
      {itens.length === 0
        ? <Text style={s.vazioTexto}>Nenhum item adicionado</Text>
        : itens.map(item => (
          <CardItem key={item.id} item={{ ...item, valor: parseFloat(item.valor) }} cor={cor} onRemover={onRemover} mostrarParcelas={mostrarParcelas} />
        ))
      }
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────
const s = StyleSheet.create({
  container:          { flex: 1, backgroundColor: CORES.fundo },
  header:             { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  headerSub:          { color: CORES.textoMedio, fontSize: 13, marginBottom: 2 },
  headerTitulo:       { color: CORES.textoEscuro, fontSize: 26, fontWeight: "800", letterSpacing: -0.8 },
  scroll:             { padding: 16, paddingBottom: 40, gap: 12 },
  saldoCard:          { backgroundColor: CORES.fundoCard, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: CORES.sucesso + "40" },
  saldoTop:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  saldoLabel:         { color: CORES.textoMedio, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
  saldoValor:         { fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  saldoInputRow:      { flexDirection: "row", alignItems: "center", gap: 6 },
  saldoPrefix:        { color: CORES.textoMedio, fontSize: 20, fontWeight: "700" },
  saldoInput:         { fontSize: 28, fontWeight: "800", color: CORES.textoEscuro, minWidth: 140 },
  btnEditarSaldo:     { backgroundColor: CORES.fundoElevado, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: CORES.borda, flexShrink: 0 },
  btnEditarSaldoTexto:{ color: CORES.textoMedio, fontSize: 13, fontWeight: "600" },
  resumoCard:         { backgroundColor: CORES.fundoCard, borderRadius: 16, padding: 18, borderWidth: 1.5, gap: 10 },
  resumoTitulo:       { color: CORES.textoEscuro, fontSize: 16, fontWeight: "800", marginBottom: 2 },
  resumoLinha:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resumoLabel:        { color: CORES.textoMedio, fontSize: 14 },
  resumoValor:        { fontSize: 15, fontWeight: "700" },
  resumoDivisor:      { height: 1, backgroundColor: CORES.borda },
  resumoLabelFinal:   { color: CORES.textoEscuro, fontSize: 16, fontWeight: "800" },
  resumoValorFinal:   { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  alertaFalta:        { backgroundColor: CORES.erroClaro, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: CORES.erroBorda },
  alertaTexto:        { color: CORES.erro, fontSize: 13, fontWeight: "600" },
  secaoCard:          { backgroundColor: CORES.fundoCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: CORES.borda, gap: 10 },
  secaoHeader:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  secaoTituloRow:     { flexDirection: "row", alignItems: "center", gap: 10 },
  secaoEmoji:         { fontSize: 24 },
  secaoTitulo:        { color: CORES.textoEscuro, fontSize: 15, fontWeight: "800" },
  secaoSub:           { color: CORES.textoMedio, fontSize: 12, marginTop: 1 },
  btnAdd:             { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  btnAddTexto:        { fontSize: 22, fontWeight: "300", lineHeight: 26 },
  vazioTexto:         { color: CORES.textoClaro, fontSize: 13, textAlign: "center", paddingVertical: 8 },
  btnLimpar:          { padding: 14, backgroundColor: CORES.erroClaro, borderRadius: 14, alignItems: "center", borderWidth: 1, borderColor: CORES.erroBorda },
  btnLimparTexto:     { color: CORES.erro, fontSize: 14, fontWeight: "600" },
});

const ci = StyleSheet.create({
  card:       { flexDirection: "row", alignItems: "center", backgroundColor: CORES.fundoElevado, borderRadius: 12, padding: 12, gap: 10, borderLeftWidth: 3 },
  nome:       { fontSize: 14, color: CORES.textoEscuro, fontWeight: "600" },
  sub:        { fontSize: 11, color: CORES.textoMedio },
  valor:      { fontSize: 15, fontWeight: "800" },
  totalSub:   { fontSize: 11, color: CORES.textoClaro },
  btnX:       { width: 24, height: 24, backgroundColor: CORES.erroClaro, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  btnXTexto:  { color: CORES.erro, fontSize: 10, fontWeight: "700" },
});

const ms = StyleSheet.create({
  overlay:              { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  backdrop:             { flex: 1 },
  kavContainer:         { justifyContent: "flex-end" },
  sheet:                { backgroundColor: CORES.fundoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 36 : 24, maxHeight: "90%" },
  handle:               { width: 40, height: 4, backgroundColor: CORES.borda, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetHeader:          { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  sheetEmoji:           { fontSize: 26 },
  sheetTitulo:          { color: CORES.textoEscuro, fontSize: 19, fontWeight: "800" },
  label:                { fontSize: 11, fontWeight: "700", color: CORES.textoMedio, marginBottom: 8, marginTop: 16, textTransform: "uppercase", letterSpacing: 1 },
  input:                { backgroundColor: CORES.fundoElevado, borderRadius: 14, padding: 14, fontSize: 16, color: CORES.textoEscuro, borderWidth: 1.5, borderColor: CORES.borda },
  inputRow:             { flexDirection: "row", alignItems: "center" },
  inputPrefix:          { backgroundColor: CORES.fundo, padding: 14, color: CORES.textoMedio, fontWeight: "700", borderWidth: 1.5, borderColor: CORES.borda, borderRightWidth: 0, borderTopLeftRadius: 14, borderBottomLeftRadius: 14, fontSize: 15 },
  parcelaPill:          { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: CORES.borda, backgroundColor: CORES.fundoElevado },
  parcelaPillTexto:     { color: CORES.textoMedio, fontSize: 13, fontWeight: "600" },
  previewParcela:       { backgroundColor: CORES.fundo, borderRadius: 12, padding: 14, borderWidth: 1, marginTop: 10 },
  previewParcelaLabel:  { color: CORES.textoClaro, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  previewParcelaValor:  { fontSize: 22, fontWeight: "800" },
  previewParcelaSub:    { color: CORES.textoMedio, fontSize: 12, marginTop: 3 },
  botoesRow:            { flexDirection: "row", gap: 10, marginTop: 20 },
  btnCancelar:          { flex: 1, backgroundColor: CORES.fundoElevado, borderRadius: 14, padding: 15, alignItems: "center", borderWidth: 1, borderColor: CORES.borda },
  btnCancelarTexto:     { color: CORES.textoMedio, fontSize: 15, fontWeight: "600" },
  btnSalvar:            { flex: 1, borderRadius: 14, padding: 15, alignItems: "center" },
  btnSalvarTexto:       { color: "#0F0F14", fontSize: 15, fontWeight: "800" },
});
