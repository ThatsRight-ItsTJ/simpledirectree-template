import { notFound } from "next/navigation";

import AppSingleClient from "@/components/app-single-client";
import { ApplicationQueryResult } from "@/lib/cms/types";
import { fetchApplication } from "@/lib/cms/fetch";
import { COMMON_PARAMS } from "@/lib/constants";
import { Metadata } from "next";
import { AllSiteConfigs } from "@/config/site";
import { getCMSImageUrl } from "@/lib/cms/fetch";

interface AppPageProps {
    params: {
        lang: string;
        app: string;
    }
}

// https://nextjs.org/docs/app/api-reference/functions/generate-metadata
export async function generateMetadata({
    params,
}: AppPageProps): Promise<Metadata> {
    const { lang, app } = params;
    console.log('generateMetadata, lang:', lang, ', app', app);
    // appSlug is url decoded from app
    const appSlug = decodeURIComponent(app);
    console.log('generateMetadata, appSlug:', appSlug);
    const queryParams = { ...COMMON_PARAMS, lang };
    // console.log('generateMetadata, queryParams:', queryParams); // queryParams: { defaultLocale: 'en', lang: 'en' }

    const appQueryResult = await fetchApplication({
        slug: appSlug,
        locale: lang as any,
        params: queryParams,
    });
    console.log('AppPage, appQueryResult:', appQueryResult);
    if (!appQueryResult) {
        return {};
    }

    const siteConfig = AllSiteConfigs[lang];
    const currentUrl = `${siteConfig.url}/${lang}/app/${appQueryResult.name}`;
    const canonicalUrl = `${siteConfig.url}/en/app/${appQueryResult.name}`;
    const ogImage = getCMSImageUrl(appQueryResult.coverImage, 960, 540);

    return {
        title: appQueryResult.name,
        description: appQueryResult.description,
        alternates: {
            canonical: canonicalUrl,
        },
        openGraph: {
            type: "website",
            url: currentUrl,
            title: appQueryResult.name,
            images: ogImage ? [ogImage] : [],
            description: appQueryResult.description,
          },
          twitter: {
            site: currentUrl,
            card: "summary_large_image",
            title: appQueryResult.name,
            description: appQueryResult.description,
            images: ogImage ? [ogImage] : [],
          },
    }
}

// https://nextjs.org/learn/dashboard-app/streaming
// use loading.tsx instead of suspense here
export default async function AppPage({ params }: AppPageProps) {
    const { lang, app } = params;
    console.log('AppPage, lang:', lang, ', app:', app);
    // appSlug is url decoded from app
    const appSlug = decodeURIComponent(app);
    console.log('AppPage, appSlug:', appSlug);
    const queryParams = { ...COMMON_PARAMS, lang };
    // console.log('AppPage, queryParams:', queryParams); // queryParams: { defaultLocale: 'en', lang: 'en' }

    const appQueryResult = await fetchApplication({
        slug: appSlug,
        locale: lang as any,
        params: queryParams,
    });
    console.log('AppPage, appQueryResult:', appQueryResult);
    if (!appQueryResult) {
        return notFound();
    }

    return (
        <AppSingleClient lang={lang} app={appQueryResult} />
    )
}