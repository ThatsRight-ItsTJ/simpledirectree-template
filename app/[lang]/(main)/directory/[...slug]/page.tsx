import { notFound } from 'next/navigation';
import { cmsFetch } from '@/lib/cms/fetch';
import { DirectoryPageClient } from '@/components/directory-page-client';
import type { DirectoryPage } from '@/lib/cms/types';

export default async function DirectoryPage({ 
  params: { lang, slug }
}: { 
  params: { lang: string; slug: string[] }
}) {
  try {
    // Handle the slug array - join with hyphens for the API
    const directorySlug = slug.join('-');
    
    // Fetch directory data using cmsFetch
    const directoryData = await cmsFetch<DirectoryPage>({
      contentType: 'directory',
      slug: directorySlug,
      locale: lang as 'en' | 'zh',
      options: {
        useCache: true,
        ttl: 3600 // Cache for 1 hour
      }
    });

    if (!directoryData) {
      notFound();
    }

    return (
      <div className="container mx-auto px-4 py-8">
        <DirectoryPageClient directory={directoryData} />
      </div>
    );
  } catch (error) {
    console.error('Directory page error:', error);
    notFound();
  }
}