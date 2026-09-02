if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registrado con éxito:', registration);
            })
            .catch(error => {
                console.error('Error al registrar ServiceWorker:', error);
            });
    });
} document.getElementById('reporte-form').addEventListener('submit', (event) => {
    event.preventDefault();

    const foto = document.getElementById('reporte-foto').files[0];
    const ubicacion = document.getElementById('reporte-ubicacion').value;
    const categoria = document.getElementById('reporte-categoria').value;

    if (!foto || !ubicacion || !categoria) {
        document.getElementById('error-msg').textContent = 'Todos los campos son obligatorios.';
        return;
    }
    document.getElementById('error-msg').textContent = '';

    console.log('Foto:', foto);
    console.log('Ubicación:', ubicacion);
    console.log('Categoría:', categoria);
});