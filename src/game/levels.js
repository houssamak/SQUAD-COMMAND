const LEVELS = {
  interior: {
    label: 'Laboratoire intérieur', sky: '#20232d', floor: '#30343e', grid: '#4b4f5a',
    hospital: { x: .12, y: .4, wall: '#577987', roof: '#2d4d5d', trim: '#b2e8e4' },
    gold: [[.6,.52],[.88,.3],[.28,.18],[.7,.84],[.11,.8],[.5,.08],[.9,.55]],
    obstacle: '#736c70', obstacleShadow: '#38343b', highlight: '#c0aeb0',
    cache: { obstacleIndex: 4, angle: -Math.PI / 4, item: 'medkit', label: 'Kit médical' },
    recruit: [[.16,.2],[.37,.18],[.7,.18],[.84,.47],[.69,.82],[.25,.8]],
    obstacles: [[.31,.36,34,'crate'],[.53,.23,31,'crate'],[.73,.4,39,'crate'],[.42,.66,43,'crate'],[.17,.63,28,'crate'],[.83,.72,32,'crate']],
    enemies: [[.9,.17],[.91,.83],[.08,.88],[.52,.08],[.05,.25],[.8,.55]]
  },
  forest: {
    label: 'Forêt boréale', sky: '#12291f', floor: '#1b3828', grid: '#31553b',
    hospital: { x: .12, y: .4, wall: '#6d8564', roof: '#394f3e', trim: '#d4e5a7' },
    gold: [[.6,.52],[.88,.3],[.28,.18],[.7,.84],[.11,.8],[.5,.08],[.9,.55]],
    obstacle: '#286244', obstacleShadow: '#143c2b', highlight: '#76b878',
    cache: { obstacleIndex: 0, angle: Math.PI / 4, item: 'rifle', label: 'Fusil de précision' },
    recruit: [[.18,.2],[.38,.18],[.72,.2],[.84,.47],[.69,.82],[.31,.78]],
    obstacles: [[.31,.37,37,'tree'],[.53,.24,30,'tree'],[.73,.4,42,'tree'],[.42,.64,46,'tree'],[.17,.62,31,'rock'],[.83,.72,34,'tree']],
    enemies: [[.9,.17],[.92,.83],[.08,.88],[.52,.08],[.05,.25],[.8,.55]]
  },
  outpost: {
    label: 'Zone militaire', sky: '#202a32', floor: '#394750', grid: '#52636c',
    hospital: { x: .12, y: .4, wall: '#8b8a70', roof: '#575d57', trim: '#e1d49b' },
    gold: [[.6,.52],[.88,.3],[.28,.18],[.7,.84],[.11,.8],[.5,.08],[.9,.55]],
    obstacle: '#65747a', obstacleShadow: '#263842', highlight: '#a5b6b7',
    cache: { obstacleIndex: 0, angle: Math.PI / 4, item: 'armor', label: 'Plaque de blindage' },
    recruit: [[.17,.22],[.37,.2],[.68,.18],[.83,.43],[.73,.79],[.25,.8]],
    obstacles: [[.32,.36,38,'rock'],[.53,.23,31,'rock'],[.72,.4,42,'rock'],[.43,.66,45,'rock'],[.17,.63,30,'rock'],[.83,.72,34,'rock']],
    enemies: [[.9,.16],[.91,.84],[.08,.88],[.52,.08],[.05,.24],[.8,.55]]
  },
  arena: {
    label: 'Arène tactique', sky: '#241c2e', floor: '#352b40', grid: '#554361',
    hospital: { x: .12, y: .4, wall: '#756786', roof: '#483d5b', trim: '#dac3ee' },
    gold: [[.6,.52],[.88,.3],[.28,.18],[.7,.84],[.11,.8],[.5,.08],[.9,.55]],
    obstacle: '#62506f', obstacleShadow: '#30243d', highlight: '#b59ac4',
    cache: { obstacleIndex: 1, angle: -Math.PI / 4, item: 'capacitor', label: 'Cellule à impulsion' },
    recruit: [[.16,.18],[.37,.2],[.72,.19],[.84,.47],[.71,.82],[.28,.8]],
    obstacles: [[.3,.36,35,'rock'],[.54,.25,33,'rock'],[.73,.4,39,'rock'],[.42,.65,43,'rock'],[.16,.62,28,'rock'],[.84,.72,32,'rock']],
    enemies: [[.9,.17],[.91,.83],[.08,.87],[.5,.08],[.05,.23],[.8,.55]]
  }
};
