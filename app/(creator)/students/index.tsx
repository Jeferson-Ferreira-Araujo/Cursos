import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, EmptyState, ErrorState, LoadingState, Screen, TextField } from '@/components/ui';
import { typography } from '@/theme';
import { useAuth } from '@/domain/auth/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { fetchStudents } from '@/domain/students/api';
import { StudentListItem } from '@/domain/students/components/StudentListItem';

export default function StudentsScreen() {
  const { account } = useAuth();
  const [search, setSearch] = useState('');
  const { data: students, loading, error, refresh, refreshing } = useAsyncData(
    () => fetchStudents(account!.id),
    [account?.id]
  );

  const filtered = useMemo(() => {
    if (!students) return [];
    const query = search.trim().toLowerCase();
    if (!query) return students;
    return students.filter(
      (s) => s.full_name.toLowerCase().includes(query) || s.email.toLowerCase().includes(query)
    );
  }, [students, search]);

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <View style={styles.header}>
        <View>
          <Text style={typography.h1}>Alunos</Text>
          <Text style={styles.subtitle}>Gerencie seus alunos.</Text>
        </View>
      </View>

      <Button label="+ Adicionar aluno" onPress={() => router.push('/(creator)/students/new')} fullWidth={false} />

      {(students?.length ?? 0) > 0 && (
        <TextField label="Buscar" placeholder="Buscar alunos..." value={search} onChangeText={setSearch} />
      )}

      {loading && <LoadingState />}
      {!!error && <ErrorState message={error} onRetry={refresh} />}
      {!loading && !error && (students?.length ?? 0) === 0 && (
        <EmptyState
          title="Nenhum aluno ainda"
          description="Adicione um aluno pelo nome e e-mail para dar acesso aos seus cursos."
          actionLabel="Adicionar aluno"
          onAction={() => router.push('/(creator)/students/new')}
        />
      )}
      {filtered.map((student) => (
        <StudentListItem key={student.id} student={student} onPress={() => router.push(`/(creator)/students/${student.id}`)} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subtitle: { ...typography.caption, marginTop: 2 },
});
