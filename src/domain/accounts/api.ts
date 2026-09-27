import { supabase } from '@/lib/supabase';
import type { Account } from './types';

/** Returns the Creator account the current user belongs to, or null if they're not a Creator (yet). */
export async function fetchMyAccount(userId: string): Promise<Account | null> {
  const { data: membership, error: membershipError } = await supabase
    .from('account_members')
    .select('account_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) return null;

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', membership.account_id)
    .single();

  if (accountError) throw accountError;
  return account;
}

export async function createCreatorAccount(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_creator_account', { p_name: name });
  if (error) throw error;
  return data as string;
}

export async function updateAccountName(accountId: string, name: string) {
  const { error } = await supabase.from('accounts').update({ name }).eq('id', accountId);
  if (error) throw error;
}
