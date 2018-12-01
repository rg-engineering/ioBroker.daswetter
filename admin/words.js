/*global systemDictionary:true */
'use strict';

systemDictionary = {
    "DasWetter.com_adapter_settings":
        {
            "en": "DasWetter.com adapter settings",
            "de": "DasWetter.com Adapter Einstellungen",
            "ru": "Настройки адаптера DasWetter.com",
            "pt": "Configurações do adaptador DasWetter.com",
            "nl": "DasWetter.com adapterinstellingen",
            "fr": "Paramètres de l'adaptateur DasWetter.com",
            "it": "Impostazioni della scheda DasWetter.com",
            "es": "Configuración del adaptador DasWetter.com",
            "pl": "Ustawienia adaptera DasWetter.com"
        },
    "URL_5_days_forecast": {
        "en": "path 2: XML-file with 5-days-weather forecast and detailled informationen for every 3 hours",
        "de": "Pfad 2: XML-Datei mit 5-Tage-Wettervorhersage und detaillierten Informationen für alle 3 Stunden",
        "ru": "путь 2: XML-файл с прогнозом погоды на 5 дней и подробной информацией за каждые 3 часа",
        "pt": "caminho 2: arquivo XML com previsão de 5 dias e informações detalhadas para cada 3 horas",
        "nl": "pad 2: XML-bestand met 5-daagse weersvoorspelling en gedetailleerde informatie voor elke 3 uur",
        "fr": "chemin 2: fichier XML avec prévisions météo à 5 jours et informations détaillées toutes les 3 heures",
        "it": "percorso 2: file XML con previsioni meteo a 5 giorni e informazioni dettagliate ogni 3 ore",
        "es": "ruta 2: archivo XML con pronóstico del tiempo para 5 días e información detallada por cada 3 horas",
        "pl": "ścieżka 2: plik XML z 5-dniową prognozą pogody i szczegółowymi informacjami co 3 godziny"
    },
    "URL_7_days_forecast": {
        "en": "path 1: XML-file with 7-days-weather forecast and general day overview",
        "de": "Pfad 1: XML-Datei mit 7-Tage-Wettervorhersage und Tagesübersicht",
        "ru": "путь 1: XML-файл с прогнозом погоды на 7 дней и общим дневным обзором",
        "pt": "caminho 1: arquivo XML com previsão de tempo de 7 dias e visão geral geral do dia",
        "nl": "pad 1: XML-bestand met 7-daagse weersvoorspelling en algemeen dagoverzicht",
        "fr": "chemin 1: fichier XML avec prévisions météo à 7 jours et aperçu général des jours",
        "it": "percorso 1: file XML con previsioni meteo a 7 giorni e panoramica generale",
        "es": "ruta 1: archivo XML con pronóstico del tiempo para 7 días y descripción general del día",
        "pl": "ścieżka 1: plik XML z 7-dniową prognozą pogody i ogólnym widokiem dnia"
    },
    "URL_hourly_forecast": {
        "en": "path 3: XML-file with weather forecast for next 5 days and hourly information ",
        "de": "Pfad 3: XML-Datei mit Wettervorhersage für die nächsten 5 Tage und stündliche Informationen",
        "ru": "путь 3: XML-файл с прогнозом погоды на ближайшие 5 дней и почасовой информацией",
        "pt": "caminho 3: arquivo XML com previsão do tempo para os próximos 5 dias e informações por hora",
        "nl": "pad 3: XML-bestand met weersvoorspelling voor de komende 5 dagen en informatie per uur",
        "fr": "chemin 3: fichier XML avec prévisions météo pour les 5 prochains jours et informations horaires",
        "it": "percorso 3: file XML con previsioni meteo per i prossimi 5 giorni e informazioni orarie",
        "es": "ruta 3: archivo XML con pronóstico del tiempo para los próximos 5 días e información por hora",
        "pl": "ścieżka 3: plik XML z prognozą pogody na następne 5 dni i godzinę"
    },
    "URL_hourly_forecast_JSON": {
        "en": "path 4: JSON-file with weather forecast for next 5 days and hourly information ",
        "de": "Pfad 4: JSON-Datei mit Wettervorhersage für die nächsten 5 Tage und stündliche Informationen",
        "ru": "путь 4: JSON-файл с прогнозом погоды на ближайшие 5 дней и почасовой информацией",
        "pt": "caminho 4: arquivo JSON com previsão do tempo para os próximos 5 dias e informações por hora",
        "nl": "pad 4: JSON-bestand met weersvoorspelling voor de komende 5 dagen en informatie per uur",
        "fr": "chemin 4: fichier JSON avec prévisions météo pour les 5 prochains jours et informations horaires",
        "it": "percorso 4: file JSON con previsioni meteo per i prossimi 5 giorni e informazioni orarie",
        "es": "ruta 4: archivo JSON con pronóstico del tiempo para los próximos 5 días e información por hora",
        "pl": "ścieżka 4: plik JSON z prognozą pogody na następne 5 dni i godzinę"
    },

    "use_only_the_URL_you_need": {
        "en": "Use only the URL you need, leave the others blank. Use arbitrary minutes in cron settings because the API server does respond late on exact hours, half hours and so on. (server overload problem).",
        "de": "Verwenden Sie nur die URL, die Sie benötigen, lassen Sie die anderen leer. Verwenden Sie beliebige Minuten in Cron-Einstellungen, da der API-Server spät auf genaue Stunden, halbe Stunden usw. reagiert. (Server-Überlastungsproblem).",
        "ru": "Используйте только URL-адрес, который вам нужен, оставьте остальные пустыми. Используйте произвольные минуты в настройках cron, потому что сервер API отвечает поздно на точные часы, полчаса и так далее. (проблема перегрузки сервера).",
        "pt": "Use apenas o URL que você precisa, deixe os outros em branco. Use minutos arbitrários nas configurações do cron porque o servidor da API responde atrasado em horas exatas, meia hora e assim por diante. (problema de sobrecarga do servidor).",
        "nl": "Gebruik alleen de URL die u nodig heeft, laat de anderen leeg. Gebruik willekeurige minuten in cron-instellingen, want de API-server reageert laat op exacte uren, een half uur enzovoort. (probleem met serveroverbelasting).",
        "fr": "Utilisez uniquement l'URL dont vous avez besoin, laissez les autres vides. Utilisez des minutes arbitraires dans les paramètres cron car le serveur d'API répond en retard à des heures précises, des demi-heures, etc. (problème de surcharge du serveur).",
        "it": "Usa solo l'URL di cui hai bisogno, lascia gli altri vuoti. Utilizza minuti arbitrari nelle impostazioni di cron perché il server API risponde in ritardo su ore esatte, mezz'ora e così via. (problema di sovraccarico del server).",
        "es": "Use solo la URL que necesita, deje los otros en blanco. Use minutos arbitrarios en la configuración de cron porque el servidor API responde tarde en horas exactas, medias horas, etc. (problema de sobrecarga del servidor).",
        "pl": "Użyj tylko potrzebnego adresu URL, pozostałe pozostałe pozostaw puste. Użyj arbitralnych minut w ustawieniach cron, ponieważ serwer API reaguje późno na dokładne godziny, pół godziny i tak dalej. (problem z przeciążeniem serwera)."
    },

    "use_new_dataset_hint": {
        "en": "data structure in version 2.x is different to 1.x. If you still want to stay compatible with 1.x just disable 'use new structure'. In version 2.x there are much more data available.",
        "de": "Die Datenstruktur in Version 2.x unterscheidet sich von 1.x. Wenn Sie immer noch mit 1.x kompatibel bleiben wollen, deaktivieren Sie einfach \"Neue Struktur verwenden\". In Version 2.x sind wesentlich mehr Daten verfügbar.",
        "ru": "структура данных в версии 2.x отличается от 1.x. Если вы все еще хотите оставаться совместимыми с 1.x, просто отключите «использовать новую структуру». В версии 2.x доступно гораздо больше данных.",
        "pt": "estrutura de dados na versão 2.x é diferente para 1.x. Se você ainda quiser permanecer compatível com 1.x, desative apenas 'use new structure'. Na versão 2.x, há muito mais dados disponíveis.",
        "nl": "datastructuur in versie 2.x is anders dan 1.x. Als je nog steeds compatibel wilt blijven met 1.x, schakel dan gewoon 'gebruik nieuwe structuur' uit. In versie 2.x zijn veel meer gegevens beschikbaar.",
        "fr": "structure de données dans la version 2.x est différente de 1.x. Si vous voulez rester compatible avec 1.x, désactivez simplement 'Utiliser une nouvelle structure'. Dans la version 2.x, il y a beaucoup plus de données disponibles.",
        "it": "la struttura dei dati nella versione 2.x è diversa da 1.x. Se vuoi comunque rimanere compatibile con 1.x, disabilita semplicemente \"usa nuova struttura\". Nella versione 2.x ci sono molti più dati disponibili.",
        "es": "la estructura de datos en la versión 2.x es diferente de 1.x. Si aún desea seguir siendo compatible con 1.x, desactive 'usar nueva estructura'. En la versión 2.x hay muchos más datos disponibles.",
        "pl": "struktura danych w wersji 2.x różni się od 1.x. Jeśli nadal chcesz być kompatybilny z 1.x, po prostu wyłącz \"użyj nowej struktury\". W wersji 2.x dostępnych jest znacznie więcej danych."
    },
    "use_new_dataset": {
        "en": "use new data structure",
        "de": "neue Datenstruktur verwenden",
        "ru": "использовать новую структуру данных",
        "pt": "usar nova estrutura de dados",
        "nl": "gebruik nieuwe datastructuur",
        "fr": "utiliser une nouvelle structure de données",
        "it": "usa una nuova struttura dati",
        "es": "usar nueva estructura de datos",
        "pl": "użyj nowej struktury danych"
    },
    "Icons": {
        "en": "Icons",
        "de": "Symbole",
        "ru": "Иконки",
        "pt": "Ícones",
        "nl": "Icons",
        "fr": "Icônes",
        "it": "Icone",
        "es": "Iconos",
        "pl": "Ikony"
    },
    "Icon set": {
        "en": "Icon set",
        "de": "Icon-Set",
        "ru": "Набор значков",
        "pt": "Conjunto de ícones",
        "nl": "Icon set",
        "fr": "Jeu d'icônes",
        "it": "Set di icone",
        "es": "Conjunto de iconos",
        "pl": "Zestaw ikon"
    },
    "parse_timeout": {
        "en": "download and parse timeout [seconds]",
        "de": "Zeitlimit für Herunterladen und Parsen [Sekunden]",
        "ru": "скачать и разобрать таймаут [секунды]",
        "pt": "baixar e analisar o tempo limite [segundos]",
        "nl": "time-out voor downloaden en parseren [seconden]",
        "fr": "télécharger et analyser le délai d'attente [secondes]",
        "it": "scarica e analizza il timeout [secondi]",
        "es": "descargar y analizar el tiempo de espera [segundos]",
        "pl": "pobierz i przeanalizuj limit czasu [sekundy]"
    },
    "delete_unused_dataset": {
        "en": "delete unused data structure",
        "de": "nicht verwendete Datenstruktur löschen",
        "ru": "удалить неиспользуемую структуру данных",
        "pt": "excluir estrutura de dados não utilizada",
        "nl": "verwijder ongebruikte gegevensstructuur",
        "fr": "supprimer la structure de données inutilisée",
        "it": "elimina la struttura dati inutilizzata",
        "es": "eliminar la estructura de datos no utilizados",
        "pl": "usuń nieużywaną strukturę danych"
    },
    "delete_unused_dataset_hint": {
        "en": "you can delete data structure of adapter version 1.x or 2.x depending your choice above. If you uncheck that option unused data structure will remain but not updated. !! Please switch off that option if not needed anymore !!",
        "de": "Sie können die Datenstruktur der Adapterversion 1.x oder 2.x löschen, je nachdem, was Sie zuvor ausgewählt haben. Wenn Sie diese Option deaktivieren, bleibt die nicht verwendete Datenstruktur erhalten, wird aber nicht aktualisiert. !! Bitte schalten Sie diese Option aus, wenn sie nicht mehr benötigt wird !!",
        "ru": "вы можете удалить структуру данных адаптера версии 1.x или 2.x в зависимости от вашего выбора выше. Если вы снимете эту опцию, неиспользуемая структура данных останется, но не будет обновлена. !! Пожалуйста, выключите эту опцию, если она больше не нужна!",
        "pt": "você pode excluir a estrutura de dados da versão 1.x ou 2.x do adaptador, dependendo da sua opção acima. Se você desmarcar essa opção, a estrutura de dados não utilizada permanecerá, mas não será atualizada. !! Por favor, desligue essa opção se não for mais necessário !!",
        "nl": "u kunt de datastructuur van adapterversie 1.x of 2.x verwijderen, afhankelijk van uw keuze hierboven. Als u de selectie van die optie ongedaan maakt, blijft de ongebruikte gegevensstructuur behouden, maar niet bijgewerkt. !! Schakel die optie uit als je hem niet meer nodig hebt !!",
        "fr": "vous pouvez supprimer la structure de données de l'adaptateur version 1.x ou 2.x selon votre choix ci-dessus. Si vous décochez cette option, la structure de données inutilisée restera mais ne sera pas mise à jour. !! Veuillez désactiver cette option si vous n'en avez plus besoin !!",
        "it": "puoi cancellare la struttura dati della versione 1.x o 2.x dell'adattatore in base alla tua scelta sopra. Se deselezioni quell'opzione, la struttura di dati inutilizzata rimarrà ma non aggiornata. !! Si prega di spegnere l'opzione se non più necessario !!",
        "es": "Puede eliminar la estructura de datos de la versión 1.x o 2.x del adaptador según su elección anterior. Si desactiva la opción, la estructura de datos no utilizados permanecerá pero no se actualizará. !! Por favor, apague esa opción si ya no la necesita!",
        "pl": "można usunąć strukturę danych adaptera w wersji 1.x lub 2.x w zależności od powyższego wyboru. Jeśli odznaczysz tę opcję, nieużywana struktura danych pozostanie, ale nie zostanie zaktualizowana. !! Proszę wyłączyć tę opcję, jeśli nie jest już potrzebna !!"
    },
    "use_png_or_svg": {
        "en": "use PNG instead of SVG",
        "de": "PNG anstelle von SVG verwenden",
        "ru": "используйте PNG вместо SVG",
        "pt": "usar PNG em vez de SVG",
        "nl": "gebruik PNG in plaats van SVG",
        "fr": "utilisez PNG au lieu de SVG",
        "it": "usa PNG invece di SVG",
        "es": "usa PNG en lugar de SVG",
        "pl": "użyj PNG zamiast SVG"
    },
    "use_png_or_svg_hint": {
        "en": "The vis app has a known issue to show SVG. In this case you can use converted PNG instead of original SVG.",
        "de": "Die vis-App hat ein bekanntes Problem, um SVG anzuzeigen. In diesem Fall können Sie konvertierte PNG anstelle der ursprünglichen SVG verwenden.",
        "ru": "Приложение vis имеет известную проблему для показа SVG. В этом случае вы можете использовать преобразованный PNG вместо исходного SVG.",
        "pt": "O aplicativo vis tem um problema conhecido para mostrar SVG. Nesse caso, você pode usar o PNG convertido em vez do SVG original.",
        "nl": "De app vis heeft een bekend probleem om SVG weer te geven. In dit geval kunt u geconverteerde PNG gebruiken in plaats van originele SVG.",
        "fr": "L'application vis a un problème connu pour montrer SVG. Dans ce cas, vous pouvez utiliser le format PNG converti au lieu du format SVG d'origine.",
        "it": "L'app vis ha un problema noto per mostrare SVG. In questo caso puoi utilizzare PNG convertito anziché SVG originale.",
        "es": "La aplicación vis tiene un problema conocido para mostrar SVG. En este caso, puede usar PNG convertido en lugar de SVG original.",
        "pl": "Aplikacja vis ma znany problem z wyświetlaniem SVG. W takim przypadku można użyć przekonwertowanego pliku PNG zamiast oryginalnego pliku SVG."
    }
};