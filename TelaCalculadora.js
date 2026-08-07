import { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, Animated, Dimensions,
} from "react-native";
import { CORES } from "./theme";

const { width } = Dimensions.get("window");

const formatBRL = (v) =>
  (parseFloat(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const JUROS_COMUNS = [
  { label: "Sem juros", valor: 0 },
  { label: "1% a.m.", valor: 1 },
  { label: "1.5% a.m.", valor: 1.5 },
  { label: "2% a.m.", valor: 2 },
  { label: "2.99% a.m.", valor: 2.99 },
];

export default function TelaCalculadora() {
  const [valorTexto, setValorTexto] = useState("");
  const [juros, setJuros] = useState(0);
  const [jurosTexto, setJurosTexto] = useState("");
  const [parcelas, setParcelas] = useState([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!valorTexto) { setParcelas([]); return; }
    const valor = parseFloat(valorTexto.replace(",", ".")) || 0;
    if (valor <= 0) { setParcelas([]); return; }

    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      const lista = [];
      for (let n = 1; n <= 24; n++) {
        let total, parcela;
        if (juros === 0) {
          parcela = valor / n;
          total = valor;
        } else {
          const taxa = juros / 100;
          parcela = valor * (taxa * Math.pow(1 + taxa, n)) / (Math.pow(1 + taxa, n) - 1);
          total = parcela * n;
        }
        lista.push({ n, parcela, total, jurosTotal: total - valor });
      }
      setParcelas(lista);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
  }, [valorTexto, juros]);

  const valor = parseFloat(valorTexto.replace(",", ".")) || 0;

  const corParcela = (n) => {
    if (n <= 3) return CORES.sucesso;
    if (n <= 6) return CORES.abaCalc;
    if (n <= 12) return CORES.aviso;
    return CORES.erro;
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerSub}>Calcule antes de comprar 💳</Text>
        <Text style={s.headerTitulo}>Simulador</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Campo valor */}
        <View style={s.inputCard}>
          <Text style={s.inputLabel}>Valor do produto</Text>
          <View style={s.inputRow}>
            <Text style={s.inputPrefix}>R$</Text>
            <TextInput
              style={s.input}
              placeholder="0,00"
              placeholderTextColor={CORES.textoClaro}
              value={valorTexto}
              onChangeText={t => setValorTexto(t.replace(/[^0-9.,]/g, ""))}
              keyboardType="decimal-pad"
              selectionColor={CORES.abaCalc}
            />
          </View>
        </View>

        {/* Juros */}
        <View style={s.inputCard}>
          <Text style={s.inputLabel}>Taxa de juros mensal</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {JUROS_COMUNS.map(j => (
              <TouchableOpacity
                key={j.valor}
                style={[s.jurosPill, juros === j.valor && { backgroundColor: CORES.abaCalc, borderColor: CORES.abaCalc }]}
                onPress={() => { setJuros(j.valor); setJurosTexto(j.valor > 0 ? String(j.valor) : ""); }}
                activeOpacity={0.8}
              >
                <Text style={[s.jurosPillTexto, juros === j.valor && { color: "#0F0F14" }]}>{j.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={[s.inputRow, { marginTop: 10 }]}>
            <TextInput
              style={[s.input, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRightWidth: 0 }]}
              placeholder="Ou digite aqui..."
              placeholderTextColor={CORES.textoClaro}
              value={jurosTexto}
              onChangeText={t => { setJurosTexto(t.replace(/[^0-9.,]/g, "")); setJuros(parseFloat(t.replace(",", ".")) || 0); }}
              keyboardType="decimal-pad"
              selectionColor={CORES.abaCalc}
            />
            <Text style={s.inputSuffix}>% a.m.</Text>
          </View>
        </View>

        {/* Tabela de parcelas */}
        {parcelas.length > 0 && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={s.tabelaTitulo}>
              Parcelamento de {formatBRL(valor)}
              {juros > 0 ? ` com ${juros}% a.m.` : " sem juros"}
            </Text>

            {parcelas.map(p => (
              <View key={p.n} style={[s.parcelaCard, { borderLeftColor: corParcela(p.n) }]}>
                <View style={[s.parcelaBadge, { backgroundColor: corParcela(p.n) + "20" }]}>
                  <Text style={[s.parcelaBadgeTexto, { color: corParcela(p.n) }]}>{p.n}x</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.parcelaValor}>{formatBRL(p.parcela)}<Text style={s.parcelaSub}>/mês</Text></Text>
                  {juros > 0 && (
                    <Text style={s.parcelaJuros}>+{formatBRL(p.jurosTotal)} em juros</Text>
                  )}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={s.parcelaTotal}>{formatBRL(p.total)}</Text>
                  <Text style={s.parcelaTotalLabel}>total</Text>
                </View>
              </View>
            ))}
          </Animated.View>
        )}

        {!valorTexto && (
          <View style={s.vazio}>
            <Text style={s.vazioEmoji}>💳</Text>
            <Text style={s.vazioTexto}>Digite um valor</Text>
            <Text style={s.vazioSub}>Veja quanto fica em cada parcela</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: CORES.fundo },
  header:           { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  headerSub:        { color: CORES.textoMedio, fontSize: 13, marginBottom: 2 },
  headerTitulo:     { color: CORES.textoEscuro, fontSize: 26, fontWeight: "800", letterSpacing: -0.8 },
  scroll:           { padding: 16, paddingBottom: 40 },
  inputCard:        { backgroundColor: CORES.fundoCard, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: CORES.borda },
  inputLabel:       { color: CORES.textoMedio, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  inputRow:         { flexDirection: "row", alignItems: "center" },
  inputPrefix:      { backgroundColor: CORES.fundoElevado, padding: 14, color: CORES.textoMedio, fontWeight: "700", borderWidth: 1.5, borderColor: CORES.borda, borderRightWidth: 0, borderTopLeftRadius: 12, borderBottomLeftRadius: 12, fontSize: 15 },
  inputSuffix:      { backgroundColor: CORES.fundoElevado, padding: 14, color: CORES.textoMedio, fontWeight: "700", borderWidth: 1.5, borderColor: CORES.borda, borderLeftWidth: 0, borderTopRightRadius: 12, borderBottomRightRadius: 12, fontSize: 13 },
  input:            { flex: 1, backgroundColor: CORES.fundoCard, borderRadius: 12, padding: 14, fontSize: 18, color: CORES.textoEscuro, borderWidth: 1.5, borderColor: CORES.borda, fontWeight: "700" },
  jurosPill:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: CORES.borda, backgroundColor: CORES.fundoElevado },
  jurosPillTexto:   { color: CORES.textoMedio, fontSize: 13, fontWeight: "600" },
  tabelaTitulo:     { color: CORES.textoMedio, fontSize: 13, fontWeight: "600", marginBottom: 12, marginTop: 4 },
  parcelaCard:      { flexDirection: "row", alignItems: "center", backgroundColor: CORES.fundoCard, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: CORES.borda, borderLeftWidth: 3, gap: 12 },
  parcelaBadge:     { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  parcelaBadgeTexto:{ fontSize: 15, fontWeight: "800" },
  parcelaValor:     { fontSize: 17, fontWeight: "800", color: CORES.textoEscuro },
  parcelaSub:       { fontSize: 12, fontWeight: "400", color: CORES.textoClaro },
  parcelaJuros:     { fontSize: 11, color: CORES.erro, marginTop: 2 },
  parcelaTotal:     { fontSize: 14, fontWeight: "700", color: CORES.textoMedio },
  parcelaTotalLabel:{ fontSize: 10, color: CORES.textoClaro },
  vazio:            { alignItems: "center", paddingTop: 80 },
  vazioEmoji:       { fontSize: 48, marginBottom: 16 },
  vazioTexto:       { fontSize: 18, color: CORES.textoMedio, fontWeight: "700" },
  vazioSub:         { fontSize: 13, color: CORES.textoClaro, marginTop: 6 },
});
