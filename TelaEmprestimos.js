import { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ScrollView, StyleSheet, SafeAreaView, Animated,
  Alert, Dimensions, Platform, KeyboardAvoidingView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import { CORES } from "./theme";

const STORAGE_KEY = "@emprestimos_v1";
const formatBRL = (v) => (parseFloat(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatData = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

// ─── Tela: Detalhes do empréstimo ──────────────────────────
function TelaDetalhes({ emprestimo, voltar, onAtualizar }) {
  const [pagamentos, setPagamentos] = useState(emprestimo.pagamentos || []);
  const [modalAberto, setModalAberto] = useState(false);
  const [valorPag, setValorPag] = useState("");
  const [obs, setObs] = useState("");
  const [arquivo, setArquivo] = useState(null);

  const totalPago = pagamentos.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);
  const restante = (parseFloat(emprestimo.valorTotal) || 0) - totalPago;
  const progresso = emprestimo.valorTotal > 0 ? Math.min(totalPago / emprestimo.valorTotal, 1) : 0;
  const quitado = restante <= 0;

  const salvarPagamento = async () => {
    if (!valorPag) return;
    const novoPag = {
      id: Date.now().toString(),
      valor: valorPag.replace(",", "."),
      data: new Date().toISOString(),
      obs: obs.trim(),
      arquivo: arquivo ? { nome: arquivo.name, uri: arquivo.uri } : null,
    };
    const novosPags = [novoPag, ...pagamentos];
    setPagamentos(novosPags);
    setModalAberto(false);
    setValorPag(""); setObs(""); setArquivo(null);

    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      const lista = json ? JSON.parse(json) : [];
      const atualizada = lista.map(e =>
        e.id === emprestimo.id ? { ...e, pagamentos: novosPags } : e
      );
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(atualizada));
      onAtualizar({ ...emprestimo, pagamentos: novosPags });
    } catch {}
  };

  const escolherArquivo = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
      if (!res.canceled && res.assets?.length > 0) setArquivo(res.assets[0]);
    } catch {}
  };

  const removerPagamento = (id) => {
    Alert.alert("Remover", "Remover este pagamento?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover", style: "destructive", onPress: async () => {
          const novos = pagamentos.filter(p => p.id !== id);
          setPagamentos(novos);
          try {
            const json = await AsyncStorage.getItem(STORAGE_KEY);
            const lista = json ? JSON.parse(json) : [];
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(
              lista.map(e => e.id === emprestimo.id ? { ...e, pagamentos: novos } : e)
            ));
            onAtualizar({ ...emprestimo, pagamentos: novos });
          } catch {}
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.subHeader}>
        <TouchableOpacity onPress={voltar} style={s.btnVoltar}>
          <Text style={s.btnVoltarTexto}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={s.subHeaderTitulo} numberOfLines={1}>{emprestimo.nome}</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Card de progresso */}
        <View style={[s.progressCard, quitado && { borderColor: CORES.sucesso + "60" }]}>
          {quitado && <View style={s.quitadoBadge}><Text style={s.quitadoTexto}>✓ QUITADO</Text></View>}
          <Text style={s.progressNome}>{emprestimo.nome}</Text>
          {emprestimo.devedor ? <Text style={s.progressSub}>👤 {emprestimo.devedor}</Text> : null}

          <View style={s.progressValores}>
            <View>
              <Text style={s.progressLabel}>Total da dívida</Text>
              <Text style={s.progressTotal}>{formatBRL(emprestimo.valorTotal)}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.progressLabel}>Restante</Text>
              <Text style={[s.progressRestante, { color: quitado ? CORES.sucesso : CORES.erro }]}>
                {quitado ? "R$ 0,00" : formatBRL(restante)}
              </Text>
            </View>
          </View>

          <View style={s.progressBg}>
            <View style={[s.progressFill, { width: `${progresso * 100}%`, backgroundColor: quitado ? CORES.sucesso : CORES.abaEmprestimo }]} />
          </View>
          <View style={s.progressRow}>
            <Text style={s.progressLabelSub}>Pago: {formatBRL(totalPago)}</Text>
            <Text style={s.progressLabelSub}>{Math.round(progresso * 100)}%</Text>
          </View>
        </View>

        {/* Botão novo pagamento */}
        {!quitado && (
          <TouchableOpacity style={s.btnNovoPag} onPress={() => setModalAberto(true)} activeOpacity={0.85}>
            <Text style={s.btnNovoPagTexto}>＋ Registrar Pagamento</Text>
          </TouchableOpacity>
        )}

        {/* Modal novo pagamento */}
        {modalAberto && (
          <View style={s.modal}>
            <Text style={s.modalTitulo}>Novo Pagamento</Text>

            <Text style={s.label}>Valor pago</Text>
            <View style={s.inputRow}>
              <Text style={s.inputPrefix}>R$</Text>
              <TextInput style={[s.input, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeftWidth: 0 }]} placeholder="0,00" placeholderTextColor={CORES.textoClaro} value={valorPag} onChangeText={t => setValorPag(t.replace(/[^0-9.,]/g, ""))} keyboardType="decimal-pad" autoFocus selectionColor={CORES.abaEmprestimo} />
            </View>

            <Text style={s.label}>Observação (opcional)</Text>
            <TextInput style={s.input} placeholder="Ex: Pix, boleto, dinheiro..." placeholderTextColor={CORES.textoClaro} value={obs} onChangeText={setObs} selectionColor={CORES.abaEmprestimo} />

            <Text style={s.label}>Comprovante PDF (opcional)</Text>
            <TouchableOpacity style={s.btnPDF} onPress={escolherArquivo} activeOpacity={0.8}>
              <Text style={s.btnPDFTexto}>{arquivo ? `📄 ${arquivo.name}` : "📎 Anexar PDF"}</Text>
            </TouchableOpacity>

            <View style={s.modalBotoes}>
              <TouchableOpacity style={s.btnCancelar} onPress={() => { setModalAberto(false); setValorPag(""); setObs(""); setArquivo(null); }} activeOpacity={0.8}>
                <Text style={s.btnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnConfirmar, !valorPag && { opacity: 0.4 }]} onPress={salvarPagamento} disabled={!valorPag} activeOpacity={0.85}>
                <Text style={s.btnConfirmarTexto}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Histórico */}
        <Text style={s.secaoTitulo}>Histórico de Pagamentos</Text>
        {pagamentos.length === 0
          ? <Text style={s.semPag}>Nenhum pagamento registrado ainda.</Text>
          : pagamentos.map(p => (
            <View key={p.id} style={s.pagCard}>
              <View style={s.pagAccent} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.pagValor}>{formatBRL(p.valor)}</Text>
                <Text style={s.pagData}>📅 {formatData(p.data)}</Text>
                {p.obs ? <Text style={s.pagObs}>💬 {p.obs}</Text> : null}
                {p.arquivo ? (
                  <View style={s.pagArquivo}>
                    <Text style={s.pagArquivoTexto}>📄 {p.arquivo.nome}</Text>
                  </View>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => removerPagamento(p.id)} style={s.btnExcluir}>
                <Text style={s.btnExcluirTexto}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
        }
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Tela: Novo Empréstimo ─────────────────────────────────
function TelaNovo({ voltar }) {
  const [nome, setNome] = useState("");
  const [devedor, setDevedor] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [erroNome, setErroNome] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (!nome.trim()) { setErroNome(true); return; }
    setSalvando(true);
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      const lista = json ? JSON.parse(json) : [];
      const novo = {
        id: Date.now().toString(),
        nome: nome.trim(),
        devedor: devedor.trim(),
        valorTotal: valorTotal.replace(",", ".") || "0",
        pagamentos: [],
        criadoEm: new Date().toISOString(),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([novo, ...lista]));
      voltar();
    } catch { setSalvando(false); }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.subHeader}>
        <TouchableOpacity onPress={voltar} style={s.btnVoltar}>
          <Text style={s.btnVoltarTexto}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={s.subHeaderTitulo}>Novo Empréstimo</Text>
        <View style={{ width: 70 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
          <Text style={s.label}>Nome / Descrição</Text>
          <TextInput style={[s.input, erroNome && s.inputErro]} placeholder={erroNome ? "⚠ Obrigatório!" : "Ex: Empréstimo João"} placeholderTextColor={erroNome ? CORES.erro : CORES.textoClaro} value={nome} onChangeText={t => { setNome(t); setErroNome(false); }} autoFocus selectionColor={CORES.abaEmprestimo} />

          <Text style={s.label}>Devedor (opcional)</Text>
          <TextInput style={s.input} placeholder="Nome de quem deve" placeholderTextColor={CORES.textoClaro} value={devedor} onChangeText={setDevedor} selectionColor={CORES.abaEmprestimo} />

          <Text style={s.label}>Valor total da dívida</Text>
          <View style={s.inputRow}>
            <Text style={s.inputPrefix}>R$</Text>
            <TextInput style={[s.input, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeftWidth: 0 }]} placeholder="0,00" placeholderTextColor={CORES.textoClaro} value={valorTotal} onChangeText={t => setValorTotal(t.replace(/[^0-9.,]/g, ""))} keyboardType="decimal-pad" selectionColor={CORES.abaEmprestimo} />
          </View>

          <TouchableOpacity style={[s.btnSalvar, salvando && { opacity: 0.6 }]} onPress={salvar} disabled={salvando} activeOpacity={0.85}>
            <Text style={s.btnSalvarTexto}>{salvando ? "Salvando..." : "Criar Empréstimo"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Tela Principal ────────────────────────────────────────
export default function TelaEmprestimos() {
  const [lista, setLista] = useState([]);
  const [tela, setTela] = useState("lista");
  const [selecionado, setSelecionado] = useState(null);

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (json) setLista(JSON.parse(json));
    } catch {}
  };

  const removerEmprestimo = (id) => {
    Alert.alert("Remover", "Remover este empréstimo e todo o histórico?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover", style: "destructive", onPress: async () => {
          const novos = lista.filter(e => e.id !== id);
          setLista(novos);
          try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(novos)); } catch {}
        }
      }
    ]);
  };

  if (tela === "novo") return <TelaNovo voltar={() => { setTela("lista"); carregar(); }} />;
  if (tela === "detalhes" && selecionado) return (
    <TelaDetalhes
      emprestimo={selecionado}
      voltar={() => { setTela("lista"); carregar(); }}
      onAtualizar={(atualizado) => {
        setSelecionado(atualizado);
        setLista(prev => prev.map(e => e.id === atualizado.id ? atualizado : e));
      }}
    />
  );

  const totalDevido = lista.reduce((s, e) => {
    const pago = (e.pagamentos || []).reduce((sp, p) => sp + (parseFloat(p.valor) || 0), 0);
    return s + Math.max(0, (parseFloat(e.valorTotal) || 0) - pago);
  }, 0);
  const quitados = lista.filter(e => {
    const pago = (e.pagamentos || []).reduce((sp, p) => sp + (parseFloat(p.valor) || 0), 0);
    return pago >= (parseFloat(e.valorTotal) || 0);
  }).length;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerSub}>Controle financeiro 💜</Text>
            <Text style={s.headerTitulo}>Empréstimos</Text>
          </View>
          <TouchableOpacity style={[s.fabAdd, { backgroundColor: CORES.abaEmprestimo, shadowColor: CORES.abaEmprestimo }]} onPress={() => setTela("novo")} activeOpacity={0.85}>
            <Text style={s.fabAddTexto}>＋</Text>
          </TouchableOpacity>
        </View>
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Total em aberto</Text>
            <Text style={[s.statValor, { color: CORES.abaEmprestimo }]}>{formatBRL(totalDevido)}</Text>
          </View>
          <View style={[s.statCard, { flex: 0.7 }]}>
            <Text style={s.statLabel}>Empréstimos</Text>
            <Text style={s.statValor}>{lista.length - quitados}<Text style={{ color: CORES.textoClaro, fontSize: 13 }}> ativos</Text></Text>
          </View>
          <View style={[s.statCard, { flex: 0.7 }]}>
            <Text style={s.statLabel}>Quitados</Text>
            <Text style={[s.statValor, { color: CORES.sucesso }]}>{quitados}</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={lista}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const pago = (item.pagamentos || []).reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);
          const total = parseFloat(item.valorTotal) || 0;
          const restante = Math.max(0, total - pago);
          const progresso = total > 0 ? Math.min(pago / total, 1) : 0;
          const quitado = restante <= 0;

          return (
            <TouchableOpacity style={[s.emprCard, quitado && { borderColor: CORES.sucesso + "40" }]} onPress={() => { setSelecionado(item); setTela("detalhes"); }} activeOpacity={0.8}>
              <View style={[s.emprAccent, { backgroundColor: quitado ? CORES.sucesso : CORES.abaEmprestimo }]} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={s.emprHeader}>
                  <Text style={s.emprNome} numberOfLines={1}>{item.nome}</Text>
                  {quitado && <View style={s.quitadoMini}><Text style={s.quitadoMiniTexto}>✓ Quitado</Text></View>}
                </View>
                {item.devedor ? <Text style={s.emprDevedor}>👤 {item.devedor}</Text> : null}
                <View style={s.emprProgressoBg}>
                  <View style={[s.emprProgressoFill, { width: `${progresso * 100}%`, backgroundColor: quitado ? CORES.sucesso : CORES.abaEmprestimo }]} />
                </View>
                <View style={s.emprValores}>
                  <Text style={s.emprPago}>Pago: {formatBRL(pago)}</Text>
                  <Text style={[s.emprRestante, { color: quitado ? CORES.sucesso : CORES.erro }]}>
                    {quitado ? "Quitado!" : `Falta: ${formatBRL(restante)}`}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => removerEmprestimo(item.id)} style={s.btnExcluir}>
                <Text style={s.btnExcluirTexto}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={s.vazio}>
            <Text style={s.vazioEmoji}>💜</Text>
            <Text style={s.vazioTexto}>Nenhum empréstimo</Text>
            <Text style={s.vazioSub}>Toque em ＋ para registrar</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:          { flex: 1, backgroundColor: CORES.fundo },
  header:             { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  headerRow:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  headerSub:          { color: CORES.textoMedio, fontSize: 13, marginBottom: 2 },
  headerTitulo:       { color: CORES.textoEscuro, fontSize: 26, fontWeight: "800", letterSpacing: -0.8 },
  subHeader:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: CORES.borda },
  subHeaderTitulo:    { color: CORES.textoEscuro, fontSize: 17, fontWeight: "700", flex: 1, textAlign: "center" },
  btnVoltar:          { backgroundColor: CORES.fundoElevado, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: CORES.borda },
  btnVoltarTexto:     { color: CORES.textoMedio, fontSize: 13, fontWeight: "600" },
  fabAdd:             { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  fabAddTexto:        { color: "#fff", fontSize: 24, fontWeight: "300", lineHeight: 28 },
  statsRow:           { flexDirection: "row", gap: 8 },
  statCard:           { flex: 1, backgroundColor: CORES.fundoCard, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: CORES.borda },
  statLabel:          { color: CORES.textoClaro, fontSize: 11, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  statValor:          { color: CORES.textoEscuro, fontSize: 15, fontWeight: "800" },
  emprCard:           { flexDirection: "row", alignItems: "center", backgroundColor: CORES.fundoCard, borderRadius: 16, padding: 14, gap: 12, borderWidth: 1, borderColor: CORES.borda, overflow: "hidden" },
  emprAccent:         { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  emprHeader:         { flexDirection: "row", alignItems: "center", gap: 8 },
  emprNome:           { fontSize: 15, color: CORES.textoEscuro, fontWeight: "700", flex: 1 },
  emprDevedor:        { fontSize: 12, color: CORES.textoMedio },
  emprProgressoBg:    { height: 4, backgroundColor: CORES.fundoElevado, borderRadius: 2, overflow: "hidden" },
  emprProgressoFill:  { height: "100%", borderRadius: 2 },
  emprValores:        { flexDirection: "row", justifyContent: "space-between" },
  emprPago:           { fontSize: 12, color: CORES.textoMedio },
  emprRestante:       { fontSize: 12, fontWeight: "700" },
  quitadoMini:        { backgroundColor: CORES.sucessoClaro, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  quitadoMiniTexto:   { color: CORES.sucesso, fontSize: 11, fontWeight: "700" },
  btnExcluir:         { width: 28, height: 28, backgroundColor: CORES.erroClaro, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: CORES.erroBorda },
  btnExcluirTexto:    { color: CORES.erro, fontSize: 11, fontWeight: "700" },
  vazio:              { alignItems: "center", paddingTop: 80 },
  vazioEmoji:         { fontSize: 48, marginBottom: 16 },
  vazioTexto:         { fontSize: 18, color: CORES.textoMedio, fontWeight: "700" },
  vazioSub:           { fontSize: 13, color: CORES.textoClaro, marginTop: 6 },
  label:              { fontSize: 11, fontWeight: "700", color: CORES.textoMedio, marginBottom: 8, marginTop: 20, textTransform: "uppercase", letterSpacing: 1 },
  input:              { backgroundColor: CORES.fundoCard, borderRadius: 14, padding: 14, fontSize: 16, color: CORES.textoEscuro, borderWidth: 1.5, borderColor: CORES.borda },
  inputErro:          { borderColor: CORES.erro },
  inputRow:           { flexDirection: "row", alignItems: "center" },
  inputPrefix:        { backgroundColor: CORES.fundoElevado, padding: 14, color: CORES.textoMedio, fontWeight: "700", borderWidth: 1.5, borderColor: CORES.borda, borderRightWidth: 0, borderTopLeftRadius: 14, borderBottomLeftRadius: 14, fontSize: 15 },
  btnSalvar:          { backgroundColor: CORES.abaEmprestimo, borderRadius: 16, padding: 17, alignItems: "center", marginTop: 28, elevation: 6 },
  btnSalvarTexto:     { color: "#0F0F14", fontSize: 16, fontWeight: "800" },
  progressCard:       { backgroundColor: CORES.fundoCard, borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1.5, borderColor: CORES.borda, gap: 10 },
  quitadoBadge:       { backgroundColor: CORES.sucessoClaro, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, alignSelf: "flex-start" },
  quitadoTexto:       { color: CORES.sucesso, fontSize: 12, fontWeight: "800" },
  progressNome:       { fontSize: 18, color: CORES.textoEscuro, fontWeight: "800" },
  progressSub:        { fontSize: 13, color: CORES.textoMedio },
  progressValores:    { flexDirection: "row", justifyContent: "space-between" },
  progressLabel:      { fontSize: 11, color: CORES.textoClaro, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  progressTotal:      { fontSize: 20, color: CORES.textoEscuro, fontWeight: "800" },
  progressRestante:   { fontSize: 20, fontWeight: "800" },
  progressBg:         { height: 8, backgroundColor: CORES.fundoElevado, borderRadius: 4, overflow: "hidden" },
  progressFill:       { height: "100%", borderRadius: 4 },
  progressRow:        { flexDirection: "row", justifyContent: "space-between" },
  progressLabelSub:   { fontSize: 12, color: CORES.textoMedio },
  btnNovoPag:         { backgroundColor: CORES.abaEmprestimo, borderRadius: 14, padding: 15, alignItems: "center", marginBottom: 20 },
  btnNovoPagTexto:    { color: "#0F0F14", fontSize: 15, fontWeight: "800" },
  modal:              { backgroundColor: CORES.fundoElevado, borderRadius: 16, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: CORES.borda },
  modalTitulo:        { color: CORES.textoEscuro, fontSize: 17, fontWeight: "800", marginBottom: 4 },
  modalBotoes:        { flexDirection: "row", gap: 10, marginTop: 20 },
  btnCancelar:        { flex: 1, backgroundColor: CORES.fundoCard, borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: CORES.borda },
  btnCancelarTexto:   { color: CORES.textoMedio, fontSize: 15, fontWeight: "600" },
  btnConfirmar:       { flex: 1, backgroundColor: CORES.abaEmprestimo, borderRadius: 12, padding: 14, alignItems: "center" },
  btnConfirmarTexto:  { color: "#0F0F14", fontSize: 15, fontWeight: "800" },
  btnPDF:             { backgroundColor: CORES.fundoCard, borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: CORES.borda, borderStyle: "dashed", alignItems: "center" },
  btnPDFTexto:        { color: CORES.abaEmprestimo, fontSize: 14, fontWeight: "600" },
  secaoTitulo:        { color: CORES.textoMedio, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12, marginTop: 4 },
  semPag:             { color: CORES.textoClaro, fontSize: 14, textAlign: "center", paddingVertical: 20 },
  pagCard:            { flexDirection: "row", alignItems: "flex-start", backgroundColor: CORES.fundoCard, borderRadius: 14, padding: 14, gap: 12, marginBottom: 8, borderWidth: 1, borderColor: CORES.borda, overflow: "hidden" },
  pagAccent:          { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: CORES.abaEmprestimo },
  pagValor:           { fontSize: 17, color: CORES.textoEscuro, fontWeight: "800" },
  pagData:            { fontSize: 12, color: CORES.textoMedio },
  pagObs:             { fontSize: 12, color: CORES.textoClaro },
  pagArquivo:         { backgroundColor: CORES.abaEmprestimo + "20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" },
  pagArquivoTexto:    { color: CORES.abaEmprestimo, fontSize: 12, fontWeight: "600" },
});
