import { notFound } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard/header";
import { DashboardShell } from "@/components/dashboard/shell";
import { UpdateApplicationForm, UpdateApplicationInfo } from "@/components/forms/update-application-form";
import { EmptyPlaceholder } from "@/components/shared/empty-placeholder";
import { buttonVariants } from "@/components/ui/button";
import { AllAppListConfigs } from "@/config/app-list";
import { COMMON_PARAMS } from "@/lib/constants";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { ApplicationListByUserQueryResult, AppTypeListQueryResult, UserQueryResult } from "@/lib/cms/types";
import { fetchUser, fetchAppTypeList, fetchApplicationsByUser } from "@/lib/cms/fetch";
import Link from "next/link";

export const metadata = {
  title: "AppList",
}

export default async function AppListPage({ params }: { params: { lang: string }; }) {
  const { lang } = params;
  const pageConfig = AllAppListConfigs[lang];
  // console.log('AppListPage, lang:', lang);
  // console.log('AppListPage, lang:', lang, 'pageConfig:', pageConfig);
  const queryParams = { ...COMMON_PARAMS, lang };
  // console.log('AppListPage, language:', lang); // language: en
  // console.log('AppListPage, queryParams:', queryParams); // queryParams: { defaultLocale: 'en', lang: 'en' }

  const user = await getCurrentUser();
  if (!user) {
    console.log("AppListPage, user not found");
    return notFound();
  }
  console.log('AppListPage, userid:', user.id);

  const [appTypeListQueryResult, applicationListByUserQueryResult, userQueryResult] = await Promise.all([
    fetchAppTypeList({
      locale: lang as any,
      params: queryParams,
    }),
    fetchApplicationsByUser({
      userId: user.id,
      locale: lang as any,
      params: {
        ...queryParams,
        userid: user.id,
      },
      options: { useCache: false },
    }),
    fetchUser({
      userId: user.id,
      locale: lang as any,
      options: { useCache: false },
    }),
  ]);
  if (!userQueryResult) {
    console.log("AppListPage, userQueryResult not found");
    return notFound();
  }
  console.log('AppListPage, sanityUser id:', userQueryResult._id, ' name:', userQueryResult.name);

  if (applicationListByUserQueryResult) {
    applicationListByUserQueryResult.sort((a, b) => {
      if (a.status === "rejected" && b.status !== "rejected") {
        return -1;
      } else if (a.status !== "rejected" && b.status === "rejected") {
        return 1;
      } else {
        return 0;
      }
    });
  }

  return (
    <DashboardShell className="">
      <DashboardHeader
        heading={pageConfig.title}
        text={pageConfig.subtitle} >
        <Link href={`/${lang}/dashboard/app`}
          className={cn(buttonVariants({ variant: "default" }))}>
          {pageConfig.submitAppButton}
        </Link>
      </DashboardHeader>

      {
        applicationListByUserQueryResult?.length > 0 &&
        applicationListByUserQueryResult.map((application) =>
        (
          <UpdateApplicationForm key={application._id} lang={lang}
            user={{ id: user.id, name: user.name || "" }}
            application={application as UpdateApplicationInfo}
            appTypeList={appTypeListQueryResult}
            sanityUser={userQueryResult} />
        )
        )
      }

      {
        applicationListByUserQueryResult?.length == 0 &&
        <div>
          <EmptyPlaceholder>
            <EmptyPlaceholder.Icon name="dashboard" />
            <EmptyPlaceholder.Title></EmptyPlaceholder.Title>
            <EmptyPlaceholder.Description>
              {pageConfig.emptyAppList}
            </EmptyPlaceholder.Description>
          </EmptyPlaceholder>
        </div>
      }

    </DashboardShell>
  )
}
