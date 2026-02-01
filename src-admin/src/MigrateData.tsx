/* eslint-disable prefer-template */
/* eslint-disable quote-props */
/* eslint-disable prettier/prettier */

type SystemConfig = any;

export default class LegacyMigrator {
    
    static migrate(
        native: any,
        systemConfig: SystemConfig,
        getIsChanged: (native: any) => boolean,
        setState: (s: Partial<any>) => void
    ): void {
        if (native === undefined || native === null) {
            return;
        }
       
        try {
            const res = this.removeEntries(native);
            native = res.native;
            if (res.removed > 0) {
                setState({ native, changed: getIsChanged(native) });
            }
        } catch (err) {
            // Fehler protokollieren, aber Migration fortsetzen
            // Aufrufer kann loggen
            console.warn("migrate exception ignored " + err);
        }

        
    }

    private static removeEntries(native: any): { native: any; removed: number } {

        /**
         * Pseudocode / Plan (detailliert):
         * 1. Falls 'native' null/undefined oder kein Objekt ist, sofort { native, removed: 0 } zurückgeben.
         * 2. Definiere eine Liste der zu entfernenden Schlüssel:
         *    - 'UsePNGorSVG'
         *    - 'WindUsePNGorSVG'
         *    - 'MoonUsePNGorSVG'
         * 3. Initialisiere einen Zähler 'removed' mit 0.
         * 4. Für jeden Schlüssel in der Liste:
         *    a. Prüfe mit Object.prototype.hasOwnProperty.call(native, key), ob der Schlüssel direkt in 'native' vorhanden ist.
         *    b. Falls vorhanden, lösche den Schlüssel mit 'delete native[key]' und inkrementiere 'removed'.
         * 5. Rückgabe eines Objekts mit dem (möglicherweise veränderten) 'native' und der Anzahl 'removed'.
         *
         * Hinweise:
         * - Nur direkte Eigenschaften von 'native' prüfen (kein Prototyp).
         * - Keine rekursive Suche/Entfernung in verschachtelten Objekten, da Anforderung sich auf 'in native' bezieht.
         * - Funktion verändert das übergebene Objekt in-place und gibt es zurück.
         */

        if (native === undefined || native === null || typeof native !== 'object') {
            return { native, removed: 0 };
        }

        const keysToRemove = ['UsePNGorSVG', 'WindUsePNGorSVG', 'MoonUsePNGorSVG'];
        let removed = 0;

        for (const key of keysToRemove) {
            if (Object.prototype.hasOwnProperty.call(native, key)) {
                try {
                    // Lösche die Eigenschaft
                    delete native[key];
                    removed++;
                } catch (e) {
                    // Falls ein Löschen fehlschlägt, protokollieren, aber weitermachen
                    // Der Aufrufer kann dies weiter behandeln
                    // Vermeide Abbruch der Migration
                    // eslint-disable-next-line no-console
                    console.warn(`removeEntries: failed to delete property ${key}: ${e}`);
                }
            }
        }

        return { native, removed };
    }



   
}