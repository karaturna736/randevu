import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export const metadata={title:'Panel erişimi · Neta'};
export default function Page(){redirect('/erisim-bekliyor')}
