import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { AgapayLogoText } from './AgapayLogo';

export function UnifiedSidebar({ navItems, roleLabel, isOpen, onToggle, onClose }) {
  const location = useLocation();

  const handleNavClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Hamburger Button - always visible */}
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 border border-gray-200"
        aria-label="Toggle menu"
      >
        {isOpen ? <X size={24} className="text-gray-700" /> : <Menu size={24} className="text-gray-700" />}
      </button>

      {/* Sidebar Overlay - only show when sidebar is open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full bg-white/95 border-r border-indigo-100 z-50 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="w-72 h-full flex flex-col">
          {/* Header */}
          <div className="border-b border-indigo-100 px-5 py-4 flex-shrink-0">
            <AgapayLogoText />
            {roleLabel && (
              <p className="text-xs text-gray-500 mt-1">{roleLabel}</p>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 overflow-y-auto">
            <p className="px-3 pt-1 pb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Menu
            </p>
            <ul className="space-y-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onClick={handleNavClick}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ease-in-out ${
                        isActive
                          ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                          : 'text-gray-700 hover:bg-indigo-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon size={18} className="flex-shrink-0" />
                      <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </aside>
    </>
  );
}