// Modulix Presença Digital V1
// O conteúdo desta demonstração é propositalmente simples para permitir
// personalização rápida antes da publicação de cada cliente.
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', event => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});
