import { useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, StatusBar, Platform } from "react-native";
import { CORES } from "./theme";
import TelaCompras from "./TelaCompras";
import TelaCalculadora from "./TelaCalculadora";
import TelaEmprestimos from "./TelaEmprestimos";
import TelaFatura from "./TelaFatura";

const ABAS = [
  { id: "fatura",      label: "Fatura",    emoji: "📊", cor: CORES.aviso },
  { id: "compras",     label: "Compras",   emoji: "🛒", cor: CORES.abaCompras },
  { id: "calcular",    label: "Calcular",  emoji: "💳", cor: CORES.abaCalc },
  { id: "emprestimos", label: "Empréstim.",emoji: "💜", cor: CORES.abaEmprestimo },
];

export default function App() {
  const [abaAtiva, setAbaAtiva] = useState("fatura");
  const indicadorAnim = useRef(new Animated.Value(0)).current;

  const mudarAba = (id) => {
    const idx = ABAS.findIndex(a => a.id === id);
    Animated.spring(indicadorAnim, { toValue: idx, tension: 60, friction: 10, useNativeDriver: true }).start();
    setAbaAtiva(id);
  };

  const abaAtual = ABAS.find(a => a.id === abaAtiva);
  const largurAba = 100 / ABAS.length;
  const abaPx = (largurAba / 100) * 400;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={CORES.fundo} />

      <View style={{ flex: 1 }}>
        {abaAtiva === "fatura"      && <TelaFatura />}
        {abaAtiva === "compras"     && <TelaCompras />}
        {abaAtiva === "calcular"    && <TelaCalculadora />}
        {abaAtiva === "emprestimos" && <TelaEmprestimos />}
      </View>

      {/* Barra de navegação */}
      <View style={s.navbar}>
        <Animated.View
          style={[s.indicador, {
            width: `${largurAba}%`,
            backgroundColor: abaAtual.cor,
            transform: [{
              translateX: indicadorAnim.interpolate({
                inputRange:  [0, 1, 2, 3],
                outputRange: [0, abaPx, abaPx * 2, abaPx * 3],
              }),
            }],
          }]}
        />
        {ABAS.map((aba) => {
          const ativo = abaAtiva === aba.id;
          return (
            <TouchableOpacity key={aba.id} style={s.abaBtn} onPress={() => mudarAba(aba.id)} activeOpacity={0.8}>
              <View style={[s.abaIconWrap, ativo && { backgroundColor: aba.cor + "20" }]}>
                <Text style={[s.abaEmoji, { opacity: ativo ? 1 : 0.35 }]}>{aba.emoji}</Text>
              </View>
              <Text style={[s.abaLabel, { color: ativo ? aba.cor : CORES.textoClaro }]}>{aba.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: CORES.fundo },
  navbar:     { flexDirection: "row", backgroundColor: CORES.fundoCard, borderTopWidth: 1, borderTopColor: CORES.borda, paddingBottom: Platform.OS === "ios" ? 24 : 8, paddingTop: 8, position: "relative", overflow: "hidden" },
  indicador:  { position: "absolute", top: 0, left: 0, height: 2, borderRadius: 2 },
  abaBtn:     { flex: 1, alignItems: "center", gap: 3 },
  abaIconWrap:{ width: 40, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  abaEmoji:   { fontSize: 18 },
  abaLabel:   { fontSize: 9, fontWeight: "700", letterSpacing: 0.2 },
});
