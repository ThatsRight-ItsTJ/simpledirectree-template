import ApplicationGridCient from "@/components/app-grid-client";
import { AllSiteConfigs } from "@/config/site";
import { COMMON_PARAMS } from "@/lib/constants";
import { AppTypeQueryResult, ApplicationData } from "@/lib/cms/types";
import { fetchAppType, fetchApplicationsByType } from "@/lib/cms/fetch";
import { Metadata } from "next";

interface AppTypePageProps {
    params: {
        lang: string;
        type: string;
    }
}

// https://nextjs.org/docs/app/api-reference/functions/generate-metadata
export async function generateMetadata({
    params,
}: AppTypePageProps): Promise<Metadata> {
    const { lang, type } = params;
    console.log('generateMetadata, lang:', lang, ', type:', type);
    const queryParams = { ...COMMON_PARAMS, lang };
    // console.log('generateMetadata, queryParams:', queryParams); // queryParams: { defaultLocale: 'en', lang: 'en' }

    const appTypeQueryResult = await fetchAppType({
        slug: type,
        locale: lang as any,
        params: queryParams,
    });
    console.log('generateMetadata, appTypeQueryResult:', appTypeQueryResult);
    if (!appTypeQueryResult) {
        return {};
    }

    const siteConfig = AllSiteConfigs[lang];
    const currentUrl = `${siteConfig.url}/${lang}/apptype/${type}`;
    const canonicalUrl = `${siteConfig.url}/en/apptype/${type}`;

    return {
        title: appTypeQueryResult.name,
        description: siteConfig.description,
        alternates: {
            canonical: currentUrl,
        },
    }
}

export default async function AppListPage({ params }: AppTypePageProps) {
    console.log('AppListPage, params:', params); // params: { lang: 'en', type: 'new' }

    const { lang, type } = params;
    const queryParams = { ...COMMON_PARAMS, lang };
    // console.log('AppListPage, language:', lang); // language: en
    // console.log('AppListPage, queryParams:', queryParams); // queryParams: { defaultLocale: 'en', lang: 'en' }

    const category = type;
    console.log('AppListPage, category:', category);

    let applicationListQueryResult: ApplicationData[];
    if (category === 'featured') {
        // For featured, we might want to fetch from a different endpoint
        applicationListQueryResult = await fetchApplicationsByType({
            typeSlug: 'featured',
            locale: lang as any,
            params: queryParams,
        });
    } else if (category === 'new') { // TODO(javayhu) may not be limited
        applicationListQueryResult = await fetchApplicationsByType({
            typeSlug: 'new',
            locale: lang as any,
            params: { ...queryParams, limit: 24 },
        });
    } else {
        applicationListQueryResult = await fetchApplicationsByType({
            typeSlug: category,
            locale: lang as any,
            params: queryParams,
        });
    }

    return (
        <ApplicationGridCient lang={lang} itemList={applicationListQueryResult}
            category={category} />
    );
}