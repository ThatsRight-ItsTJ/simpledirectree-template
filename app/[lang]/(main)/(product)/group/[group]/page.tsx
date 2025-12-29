import { COMMON_PARAMS } from "@/lib/constants";
import { GroupData } from "@/lib/cms/types";
import { fetchGroup } from "@/lib/cms/fetch";
import { redirect } from "next/navigation";

// NOTICE(javayhu) can be deleted
export default async function GroupPage({ params }: { params: { lang: string, group: string }; }) {
    console.log('GroupPage, params:', params); // params: { lang: 'en' }
    const { lang, group } = params;
    const queryParams = { ...COMMON_PARAMS, lang };
    // console.log('GroupPage, language:', lang); // language: en
    // console.log('GroupPage, queryParams:', queryParams); // queryParams: { defaultLocale: 'en', lang: 'en' }

    const groupData = await fetchGroup({
        slug: group,
        locale: lang as any,
        params: queryParams,
    });
    
    if (!groupData || !groupData.categories || groupData.categories.length === 0) {
        console.log('GroupPage, groupItem is undefined, redirect to new');
        return redirect(`/${lang}/group/new`);
    }
    
    return redirect(`/${lang}/group/${group}/category/${groupData.categories[0].slug}`);
}