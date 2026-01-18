import { env } from "@/env.mjs";
import { type MetadataRoute } from 'next';
import { i18n } from "../i18n-config";
import {
  fetchAppListForSitemap,
  fetchAppTypeListForSitemap,
  fetchCategoryListForSitemap,
  fetchProductListForSitemap,
  fetchDirectoryListForSitemap
} from "@/lib/cms/fetch";
import type {
  AppListQueryForSitemapResult,
  AppTypeListQueryForSitemapResult,
  CategoryListQueryForSitemapResult,
  ProductListQueryForSitemapResult,
  DirectoryListQueryForSitemapResult
} from "@/lib/cms/types";

const site_url = env.NEXT_PUBLIC_APP_URL;

// https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
// https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap#generate-a-localized-sitemap
// https://nextjs.org/docs/app/api-reference/functions/generate-sitemaps
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    console.log('sitemap start');

    const sitemapList: MetadataRoute.Sitemap = []; // final result

    const sitemapRoutes: MetadataRoute.Sitemap = [
        {
            url: '', // home
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
        {
            url: 'dashboard/submit',
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 1,
        },
        {
            url: 'dashboard/app',
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 1,
        },
        {
            url: 'about',
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
        },
        {
            url: 'privacy',
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.8,
        },
        {
            url: 'terms',
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.8,
        },
    ];

    sitemapRoutes.forEach((route) => {
        i18n.locales.forEach((locale) => {
            const lang = `/${locale}`;
            const routeUrl = route.url === '' ? '' : `/${route.url}`;
            console.log(`sitemap, url:${site_url}${lang}${routeUrl}`);
            sitemapList.push({
                ...route,
                url: `${site_url}${lang}${routeUrl}`,
            });
        })
    })

    const [appListQueryResult, appTypeListQueryResult,
        categoryListQueryResult, productListQueryResult,
        directoryListQueryResult] = await Promise.all([
            fetchAppListForSitemap({ locale: 'en' }),
            fetchAppTypeListForSitemap({ locale: 'en' }),
            fetchCategoryListForSitemap({ locale: 'en' }),
            fetchProductListForSitemap({ locale: 'en' }),
            fetchDirectoryListForSitemap({ locale: 'en' }),
        ]);

    console.log('sitemap, appListQueryResult size:', appListQueryResult.length);
    console.log('sitemap, appTypeListQueryResult size:', appTypeListQueryResult.length);
    console.log('sitemap, categoryListQueryResult size:', categoryListQueryResult.length);
    console.log('sitemap, productListQueryResult size:', productListQueryResult.length);
    console.log('sitemap, directoryListQueryResult size:', directoryListQueryResult.length);

    appListQueryResult.forEach((app) => {
        i18n.locales.forEach((locale) => {
            const lang = `/${locale}`;
            if (app.name) {
                const routeUrl = `/app/${encodeURIComponent(app.name)}`;
                console.log(`sitemap, url:${site_url}${lang}${routeUrl}`);
                sitemapList.push({
                    url: `${site_url}${lang}${routeUrl}`,
                    lastModified: new Date(),
                    changeFrequency: 'daily',
                    priority: 1,
                });
            } else {
                console.warn(`sitemap, name invalid, id:${app.id}`);
            }
        })
    })

    appTypeListQueryResult.forEach((apptype) => {
        i18n.locales.forEach((locale) => {
            const lang = `/${locale}`;
            const routeUrl = `/apptype/${apptype.slug}`;
            console.log(`sitemap, url:${site_url}${lang}${routeUrl}`);
            sitemapList.push({
                url: `${site_url}${lang}${routeUrl}`,
                lastModified: new Date(),
                changeFrequency: 'daily',
                priority: 1,
            });
        })
    })

    categoryListQueryResult.forEach((category) => {
        i18n.locales.forEach((locale) => {
            const lang = `/${locale}`;
            const routeUrl = `/group/${category.group?.slug}/category/${category.slug}`;
            console.log(`sitemap, url:${site_url}${lang}${routeUrl}`);
            sitemapList.push({
                url: `${site_url}${lang}${routeUrl}`,
                lastModified: new Date(),
                changeFrequency: 'daily',
                priority: 1,
            });
        })
    })

    productListQueryResult.forEach((product) => {
        i18n.locales.forEach((locale) => {
            const lang = `/${locale}`;
            const routeUrl = `/product/${product.slug}`;
            console.log(`sitemap, url:${site_url}${lang}${routeUrl}`);
            sitemapList.push({
                url: `${site_url}${lang}${routeUrl}`,
                lastModified: new Date(),
                changeFrequency: 'daily',
                priority: 1,
            });
        })
    })

    directoryListQueryResult.forEach((directory) => {
        i18n.locales.forEach((locale) => {
            const lang = `/${locale}`;
            const routeUrl = `/directory/${directory.slug}`;
            console.log(`sitemap, url:${site_url}${lang}${routeUrl}`);
            sitemapList.push({
                url: `${site_url}${lang}${routeUrl}`,
                lastModified: new Date(),
                changeFrequency: 'daily',
                priority: 0.9,
            });
        })
    })

    console.log('sitemap end, size:', sitemapList.length);
    return sitemapList;
}
