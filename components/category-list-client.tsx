'use client';

import { cn } from '@/lib/utils';
import { GroupQueryResult } from '@/lib/cms/types';
import Link from 'next/link';
import { notFound, usePathname } from 'next/navigation';

interface CategoryListClientProps {
  lang: string;
  group: GroupQueryResult;
}

export default function CategoryListClient({ lang, group }: CategoryListClientProps) {
  const pathname = usePathname();
  // console.log('CategoryListClient, lang:', lang);

  if (!group) {
    console.log('CategoryListClient, group is null');
    return notFound();
  }
  // pathname is like /en/group/web-app/category/web, group is web-app, category is web
  // or pathname is like /en/group/featured, group is featured, category is none
  // get group and category from pathname
  const segments = pathname.split('/');
  // const group = segments[3];
  const category = segments[5];
  // console.log('CategoryListClient, group:', group, ', category:', category);
  console.log('CategoryListClient, group:', group.slug, ', category:', category);

  return (
    <>
      {
        group.categories && group.categories.length > 1 &&
        <div className="flex gap-4 items-center border-t pt-4 md:border-transparent md:pt-0">
          <div className="flex flex-wrap items-center gap-4">
            {
              group.categories && group.categories.length > 0 &&
              group.categories.map((item) => (
                <Link key={item._id}
                  href={group.slug === 'new' || group.slug === 'featured'
                    ? `/${lang}/group/${group.slug}`
                    : `/${lang}/group/${group.slug}/category/${item.slug}`}
                  className={
                    cn(
                      'border text-sm py-1 px-3 cursor-pointer rounded-full font-medium line-clamp-1',
                      'hover:bg-primary/90 hover:text-primary-foreground',
                      'dark:text-foreground dark:hover:bg-primary-800',
                      category === item.slug ? "bg-primary text-primary-foreground" : "",
                    )
                  }
                >
                  <h4>{item.name}</h4>
                </Link>
              ))
            }
          </div>
        </div>
      }
    </>
  )
}
