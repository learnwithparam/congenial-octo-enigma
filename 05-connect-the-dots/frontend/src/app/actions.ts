'use server';

import { revalidatePath } from 'next/cache';
import { revalidateTag } from 'next/cache';

export async function revalidateStartups() {
  revalidateTag('startups');
  revalidatePath('/startups');
  revalidatePath('/');
}

export async function revalidateStartup(id: number) {
  revalidateTag('startup-' + id);
  revalidatePath('/startups/' + id);
}
