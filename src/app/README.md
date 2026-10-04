# src/app — слой приложения (FSD)

Монтирование, провайдеры, глобальный сетап. Создан как каркас в R1
(`devAI/spec/ROADMAP-fsd.md`); переезд кода (main.tsx, App.tsx, провайдеры)
— в R4.

Правила зависимостей: `app → features → shared`, легаси-пути — во временном
allowlist depcruise (`fsd-app-layers`, `.dependency-cruiser.cjs`, пометка R4).
