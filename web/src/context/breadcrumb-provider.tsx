import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from 'react';

export type BreadcrumbInfo = {
  label: string;
  path: string;
  isLoading?: boolean;
};

type BreadcrumbContextType = {
  setBreadcrumb: (path: string, info: Omit<BreadcrumbInfo, 'path'>) => void;
  clearBreadcrumb: (path: string) => void;
  breadcrumbs: Record<string, BreadcrumbInfo>;
};

const BreadcrumbContext = createContext<BreadcrumbContextType | null>(null);

export function BreadcrumbProvider({children}: {children: ReactNode}) {
  const [breadcrumbs, setBreadcrumbs] = useState<
    Record<string, BreadcrumbInfo>
  >({});

  // Use useCallback to memoize the setBreadcrumb function
  // This prevents it from being recreated on every render
  const setBreadcrumb = useCallback(
    (path: string, info: Omit<BreadcrumbInfo, 'path'>) => {
      setBreadcrumbs(prev => {
        // Only update if the info has actually changed
        const currentInfo = prev[path];
        const newInfo = {...info, path};

        if (
          currentInfo?.label === newInfo.label &&
          currentInfo?.isLoading === newInfo.isLoading
        ) {
          // Return same object reference if no changes
          return prev;
        }

        return {
          ...prev,
          [path]: newInfo,
        };
      });
    },
    []
  );

  // Use useCallback to memoize the setBreadcrumb function
  // This prevents it from being recreated on every render
  const clearBreadcrumb = useCallback((path: string) => {
    setBreadcrumbs(prev => {
      // Only update if the info has actually changed
      if (prev[path] !== undefined) {
        const updated = {...prev};
        delete updated[path];
        return updated;
      } else {
        return prev;
      }
    });
  }, []);

  return (
    <BreadcrumbContext.Provider
      value={{setBreadcrumb, breadcrumbs, clearBreadcrumb}}
    >
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumb() {
  const context = useContext(BreadcrumbContext);
  if (!context) {
    throw new Error('useBreadcrumb must be used within a BreadcrumbProvider');
  }
  return context;
}
