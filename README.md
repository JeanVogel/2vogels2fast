# 2 Vogels 2 Fast · Bloodline Racing

Jogo de corrida no navegador, Pai × Filho, inspirado no Stunts (1990).
Duelos contra o relógio, um de cada vez, cada um no seu computador: quem desafia escolhe o carro e a pista,
o outro corre contra o ghost. Placar de vitórias, derrotas e empates.

- `index.html`: o jogo inteiro (three.js carregado do jsDelivr).
- `c4vts.json`, `rsq3.json`: modelos 3D do C4 VTR e da RS Q3.
- `abertura.jpg`, `logo.webp`: capa e logo.
- `firestore.rules`: regras do banco do placar (Firebase).

O placar compartilhado usa o Firestore quando a configuração do Firebase está embutida na página;
sem ela, o placar fica só no navegador.

Controles: setas ou WASD, espaço freio de mão, Shift nitro, C câmera, R volta ao checkpoint, Esc pausa. Controle de videogame também funciona.

Código-fonte em `src/` (`core.js` pistas, física e ghost; `game.js` gráficos, som, telas e duelo; `shell.html` página e estilos).
Para gerar a página: `python3 build.py --site` dentro de uma cópia que tenha os arquivos de modelo e imagem.
