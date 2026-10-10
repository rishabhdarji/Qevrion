import Constants from 'expo-constants';
import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Qevrion {Constants.expoConfig?.version}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0E0E10',
  },
  title: {
    color: '#F2EFEA',
    fontSize: 24,
  },
});
