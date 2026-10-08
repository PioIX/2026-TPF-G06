CREATE TABLE Ingredientes (
    id_ingrediente INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(200),
    seccion VARCHAR(200),
    id_partida INT NOT NULL,
	FOREIGN KEY (id_partida) REFERENCES Partidas(id_partida)
    
);

CREATE TABLE Partidas (
	id_partida INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    id_usuario INT NOT NULL,
	hora_final DATETIME NOT NULL,
    ranking INT NOT NULL,
	FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario)
);

CREATE TABLE UsuarioxPartidas (
id_UXP INT AUTO_INCREMENT PRIMARY KEY,
id_usuario INT NOT NULL,
id_partida INT NOT NULL,
FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario),
FOREIGN KEY (id_partida) REFERENCES Partidas(id_partida)
);