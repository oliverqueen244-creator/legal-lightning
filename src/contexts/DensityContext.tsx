import React, { createContext, useContext, useState, useEffect } from 'react';

type Density = 'normal' | 'compact' | 'high';

interface DensityContextType {
    density: Density;
    setDensity: (density: Density) => void;
    toggleDensity: () => void;
}

const DensityContext = createContext<DensityContextType | undefined>(undefined);

export function DensityProvider({ children }: { children: React.ReactNode }) {
    const [density, setDensity] = useState<Density>(() => {
        const saved = localStorage.getItem('sovereign-density');
        return (saved as Density) || 'normal';
    });

    useEffect(() => {
        localStorage.setItem('sovereign-density', density);
        document.documentElement.setAttribute('data-density', density);
    }, [density]);

    const toggleDensity = () => {
        setDensity((prev) => {
            if (prev === 'normal') return 'compact';
            if (prev === 'compact') return 'high';
            return 'normal';
        });
    };

    return (
        <DensityContext.Provider value={{ density, setDensity, toggleDensity }}>
            {children}
        </DensityContext.Provider>
    );
}

export function useDensity() {
    const context = useContext(DensityContext);
    if (context === undefined) {
        throw new Error('useDensity must be used within a DensityProvider');
    }
    return context;
}
