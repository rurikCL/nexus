import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.{js,jsx}',
    ],

    theme: {
        extend: {
            fontFamily: {
                sans:    ['Inter', ...defaultTheme.fontFamily.sans],
                display: ['Orbitron', ...defaultTheme.fontFamily.sans],
                data:    ['JetBrains Mono', ...defaultTheme.fontFamily.mono],
            },
            colors: {
                holo: {
                    DEFAULT: 'oklch(0.82 0.13 215)',
                    dim:     'oklch(0.62 0.10 220)',
                    faint:   'oklch(0.82 0.13 215 / 0.18)',
                    line:    'oklch(0.82 0.13 215 / 0.32)',
                },
                naranja: { DEFAULT: '#FF6B00', dark: '#E55F00' },
                oro:     { DEFAULT: '#E6B325', light: '#F5D167' },
                space: {
                    900: '#04070f',
                    800: '#07101f',
                    700: '#0a1830',
                    600: '#0e2245',
                },
            },
            boxShadow: {
                'nx':       '0 1px 0 rgba(255,255,255,0.06) inset, 0 2px 8px rgba(0,0,0,0.5), 0 8px 24px -6px rgba(0,0,0,0.6), 0 24px 60px -16px rgba(0,0,0,0.85)',
                'nx-glow':  '0 1px 0 rgba(255,255,255,0.08) inset, 0 0 0 1px oklch(0.82 0.13 215 / 0.2), 0 0 40px -12px oklch(0.82 0.13 215 / 0.35), 0 8px 24px -6px rgba(0,0,0,0.6), 0 24px 60px -16px rgba(0,0,0,0.85)',
                'nx-orange': '0 0 28px -8px rgba(255,107,0,0.55)',
                'nx-gold':   '0 0 28px -8px rgba(230,179,37,0.55)',
                'nx-deep':   '0 4px 6px -1px rgba(0,0,0,0.5), 0 25px 60px -15px rgba(0,0,0,0.9)',
            },
        },
    },

    plugins: [forms],
};
