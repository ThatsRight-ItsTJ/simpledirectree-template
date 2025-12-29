'use client';

import { cn } from '@/lib/utils';
import { GroupListWithCategoryQueryResult } from '@/lib/cms/types';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface GroupListClientProps {
  lang: string;
  itemList: GroupListWithCategoryQueryResult;
}

export default function GroupListClient({ lang, itemList }: GroupListClientProps) {
  // console.log('GroupListClient, lang:', lang);
  // console.log('GroupListClient, itemList:', itemList);
  const pathname = usePathname();
  // pathname is like /en/group/web-app/category/web, group is web-app, category is web
  // or pathname is like /en/group/featured, group is featured, category is none
  // get group and category from pathname
  const segments = pathname.split('/');
  const group = segments[3];
  const category = segments[5];
  console.log('GroupListClient, group:', group, ', category:', category);

  return (
    <div className="sticky top-24 max-h-[calc(var(--vh)-4rem)] overflow-y-auto">
      <div className="mb-8 md:mb-0 md:space-y-1 flex flex-wrap gap-2">
        {itemList.map((item) => (
          <div key={item._id} className='md:w-full'>
            {
              item.name && item.categories && item.categories.length > 0 &&
              (
                <Link
                  href={item.slug === 'new' || item.slug === 'featured' ? `/${lang}/group/${item.slug}`
                    : `/${lang}/group/${item.slug}/category/${item.categories[0].slug}`}
                  className={
                    cn(
                      'border text-sm py-2 px-3 cursor-pointer rounded-md line-clamp-1',
                      'font-medium hover:bg-accent hover:text-primary dark:text-foreground',
                      group === item.slug ? "bg-accent text-primary font-bold" : "",
                    )
                  }
                >
                  <h3>{item.name}</h3>
                </Link>
              )
            }
          </div>
        ))}
      </div>
    </div>
  )
}
