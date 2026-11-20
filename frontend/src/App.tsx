import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PageDetailPage } from '@/pages/PageDetailPage';
import { PagesListPage } from '@/pages/PagesListPage';

export default function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <div className="min-h-screen bg-muted/40">
          <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
            <header>
              <Link to="/" className="text-2xl font-semibold tracking-tight">
                Koomb
              </Link>
              <p className="text-sm text-muted-foreground">
                Add a web page and list every link found on it.
              </p>
            </header>
            <Routes>
              <Route path="/" element={<PagesListPage />} />
              <Route path="/pages/:id" element={<PageDetailPage />} />
            </Routes>
          </main>
        </div>
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </BrowserRouter>
  );
}
