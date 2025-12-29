'use client';

import { formatDate } from '@/lib/utils';
import { ApplicationData } from '@/lib/cms/types';
import { getCMSImageUrl } from '@/lib/cms/fetch';
import Image from "next/image";
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { ArrowUpRightFromCircleIcon, ArrowUpRightFromSquareIcon, ArrowUpRightIcon, ExternalLinkIcon } from 'lucide-react';

interface AppGridCientProps {
  lang: string;
  itemList: ApplicationData[];
  category: string;
}

export default function AppGridCient({ lang, itemList, category }: AppGridCientProps) {
  // console.log('AppGridCient, lang:', lang, ', category:', category);
  // console.log('AppGridCient, itemList:', itemList);

  return (
    <>
      <div className="flex flex-col space-y-8">
        <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {itemList.map((item) => {
            console.info('AppGridCient, create item for ', item);
            const logoImageUrl = getCMSImageUrl(item.logo, 96, 96);
            // console.error('AppGridCient, logo image url: ', logoImageUrl);
            if (!logoImageUrl) {
              console.warn('AppGridCient, no logo image for ', item.name);
            }
            return logoImageUrl && (
              // href={`${item.link}`}
              <Link key={item._id || item.id} href={`/${lang}/app/${item.name}`}>
                {/* transition-all hover:bg-accent md:scale-100 md:hover:scale-105 */}
                <div
                  className="group cursor-pointer overflow-hidden 
                    rounded-xl border p-5 md:py-5
                    shadow-sm hover:shadow-lg"
                >
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Image alt="image" className="rounded-sm"
                          height={48} width={48}
                          placeholder='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgBAMAAAAQtmoLAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAASUExURe7u8LO0vunq7N7e4sHCyszM05J1rm8AAAB2SURBVFjD7dXdCYAwDEbRmAkMOEDQBZRMUHCBIu6/iq2tj4IVxL/vQClC74MVIhEAAPwNt0l6yju3uhsMsmrSwbxXUt8YdGZOJrPDQeCl324AwVsDGSNXEGQXBnPkS16aSRVfGsGJoHjyPXB6EymHhV8xAMDnLNyhJR10BfPFAAAAAElFTkSuQmCC'
                          src={logoImageUrl} />

                        <div className='ml-4 flex flex-col gap-2'>
                          <h3 className="text-lg font-semibold font-heading line-clamp-1">
                            {item.name}
                          </h3>
                        </div>
                      </div>

                      <Link href={`${item.link}`}
                        target="_blank"
                        className='p-2 bg-muted rounded-full text-muted-foreground
                        hover:bg-accent hover:text-accent-foreground'>
                        {/* <ArrowUpRightFromSquareIcon className="size-5" /> */}
                        <ArrowUpRightIcon className="size-5" />
                      </Link>
                    </div>

                    <p className="line-clamp-3 text-muted-foreground">
                      {item.description}
                    </p>

                    {/* app types */}
                    {item.types && (
                      <div className="flex flex-wrap gap-2 items-center">
                        {item.types.map((tag: any) => (
                          <Link key={tag._id || tag.id}
                            href={`/${lang}/apptype/${tag.slug}`}
                          >
                            <Badge key={tag._id || tag.id} variant="outline" className="text-xs py-1 px-3 
                            text-primary dark:text-foreground/80
                            hover:border-transparent dark:hover:border-transparent
                            hover:bg-primary hover:text-primary-foreground dark:hover:text-primary-foreground
                            dark:hover:bg-primary-800 dark:border-primary-foreground/20">
                              {tag.name}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    )}

                    {/* user info */}
                    {
                      item.user && (
                        <div className='border-t pt-4 flex items-center justify-between space-x-2'>
                          <div className='flex items-center space-x-2'>
                            {
                              item.user?.avatar && (
                                <Avatar className="size-6 border flex item-center justify-center">
                                  <AvatarImage className='rounded-full' src={item.user.avatar} alt={item.user.name ?? ""} />
                                  <AvatarFallback className='item-center justify-center'>
                                    {/* {item.user.name} */}
                                  </AvatarFallback>
                                </Avatar>
                              )
                            }
                            {
                              item.user?.name && (
                                <>
                                  {
                                    item.user.link && (
                                      <Link href={item.user?.link ?? '#'} target='_blank'
                                        className='text-sm text-muted-foreground line-clamp-1 
                            hover:underline hover:underline-offset-4 hover:text-primary' >
                                        {item.user?.name || 'unknown'}
                                      </Link>
                                    )
                                  }
                                  {
                                    !item.user?.link && (
                                      <span className='text-sm text-muted-foreground line-clamp-1'>
                                        {item.user?.name || 'unknown'}
                                      </span>
                                    )
                                  }
                                </>
                              )
                            }
                          </div>
                          <span className='text-sm text-muted-foreground'>
                            {formatDate(item._createdAt || item.createdAt || '')}
                          </span>
                        </div>
                      )
                    }
                  </div>

                  {/* <Link href={`${item.link}`} target='_blank' className='absolute inset-0'>
                  <span className="sr-only">View</span>
                </Link> */}
                </div>
              </Link>
            )
          })}
        </div>

      </div>
    </>
  )
}
