# src/features/objects

Доменная вертикаль «objects» (FSD). Каркас создан в R1; переезд компонентов,
хуков и api-клиента домена — в R4 (`devAI/spec/ROADMAP-fsd.md`).
Фичи не импортируют друг друга — только через `shared/`
(depcruise: `fsd-features-no-cross-imports`).
