const servicesRows = cycleServices.map((service, index) => {
      const price = parseFloat(service.price) || 0;
      const discountPercent = parseFloat(service.discountPercent) || 0;
      const discountAmount = (price * discountPercent) / 100;
      const finalPrice = price - discountAmount;
      
      // Mantener el porcentaje original sin redondear
      const displayDiscount = service.discountPercent ? String(service.discountPercent) : '0';
      
      return `
        <tr>
          <td style="color: #6b7280;">${index + 1}</td>
          <td style="color: #6b7280;">${new Date(service.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</td>
          <td style="color: #374151;">${service.origin} → ${service.destination}</td>
          <td style="color: #374151;">${service.clientName || '-'}</td>
          <td style="text-align: right; color: #374151;">${price.toFixed(2)} €</td>
          <td style="text-align: right; color: ${discountPercent > 0 ? '#ef4444' : '#6b7280'};">${discountPercent > 0 ? `-${displayDiscount}%` : '-'}</td>
          <td style="text-align: right; color: #4caf50; font-weight: 700;">${finalPrice.toFixed(2)} €</td>
        </tr>
        ${service.observations ? `
        <tr>
          <td colspan="7" style="padding: 5px 6px 7px 6px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 9px; font-style: italic;">Obs: ${service.observations}</td>
        </tr>
        ` : ''}
      `;
    }).join('');