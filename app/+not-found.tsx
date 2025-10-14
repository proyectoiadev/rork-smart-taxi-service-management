import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Página no encontrada" }} />
      <View style={styles.container}>
        <Text style={styles.title}>Esta página no existe</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Volver al inicio</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#F3F4F6",
  },
  title: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: "#2D3748",
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 16,
    color: "#4CAF50",
    fontWeight: "600" as const,
  },
});
