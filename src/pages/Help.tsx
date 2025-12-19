import React from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { 
  HelpCircle, 
  Package, 
  FileText, 
  Users, 
  Bell, 
  Download, 
  Search, 
  BarChart3,
  TicketIcon,
  BookOpen,
  MessageCircle
} from 'lucide-react';

const Help: React.FC = () => {
  const guides = [
    {
      icon: Package,
      title: 'Catálogo de Produtos',
      description: 'Como navegar e encontrar produtos',
      content: `
        <h4>Acessando o Catálogo</h4>
        <ol>
          <li>No menu lateral, clique em <strong>"Catálogo"</strong></li>
          <li>Você verá todos os produtos disponíveis para seu perfil</li>
          <li>Use a barra de pesquisa para encontrar produtos específicos</li>
          <li>Filtre por categoria usando o seletor no topo da página</li>
        </ol>
        
        <h4>Visualizando Detalhes</h4>
        <ol>
          <li>Clique no card de um produto para ver mais informações</li>
          <li>Na página de detalhes você encontra descrição completa, ficha técnica e condições comerciais</li>
          <li>Baixe a ficha técnica em PDF quando disponível</li>
        </ol>
      `
    },
    {
      icon: FileText,
      title: 'Materiais Comerciais',
      description: 'Como baixar materiais e fichas técnicas',
      content: `
        <h4>Acessando os Materiais</h4>
        <ol>
          <li>Acesse o menu <strong>"Materiais Comerciais"</strong></li>
          <li>Os arquivos são organizados por categoria e subcategoria</li>
          <li>Clique em uma subcategoria para ver os arquivos disponíveis</li>
        </ol>
        
        <h4>Baixando Arquivos</h4>
        <ol>
          <li>Localize o arquivo desejado na lista</li>
          <li>Clique no botão de download ou no nome do arquivo</li>
          <li>O download iniciará automaticamente</li>
        </ol>
      `
    },
    {
      icon: Bell,
      title: 'Notificações',
      description: 'Como gerenciar suas notificações',
      content: `
        <h4>Visualizando Notificações</h4>
        <ol>
          <li>Clique no ícone de sino no cabeçalho ou acesse <strong>"Notificações"</strong> no menu</li>
          <li>Notificações não lidas aparecem com destaque</li>
          <li>Você pode marcar todas como lidas de uma vez</li>
        </ol>
        
        <h4>Tipos de Notificações</h4>
        <ul>
          <li><strong>Gerais:</strong> Enviadas para todos ou grupos de usuários</li>
          <li><strong>Pessoais:</strong> Enviadas especificamente para você</li>
        </ul>
      `
    },
    {
      icon: Search,
      title: 'Pesquisa e Filtros',
      description: 'Como encontrar informações rapidamente',
      content: `
        <h4>Usando a Pesquisa</h4>
        <ol>
          <li>Use a barra de pesquisa no topo de cada página</li>
          <li>Digite palavras-chave do que procura</li>
          <li>A pesquisa filtra em tempo real</li>
        </ol>
        
        <h4>Usando Filtros</h4>
        <ol>
          <li>Utilize os filtros de categoria quando disponíveis</li>
          <li>Combine pesquisa com filtros para resultados precisos</li>
        </ol>
      `
    },
    {
      icon: Users,
      title: 'Perfil e Conta',
      description: 'Como gerenciar seu perfil',
      content: `
        <h4>Acessando seu Perfil</h4>
        <ol>
          <li>Clique no seu nome no canto superior direito</li>
          <li>Selecione <strong>"Meu Perfil"</strong></li>
        </ol>
        
        <h4>Alterando Informações</h4>
        <ol>
          <li>Na página de perfil, edite seus dados pessoais</li>
          <li>Atualize sua foto de perfil se desejar</li>
          <li>Salve as alterações clicando no botão correspondente</li>
        </ol>
      `
    },
    {
      icon: BarChart3,
      title: 'Relatórios',
      description: 'Como visualizar relatórios (Gerentes e Admins)',
      content: `
        <h4>Acessando Relatórios</h4>
        <ol>
          <li>No menu, clique em <strong>"Relatórios"</strong></li>
          <li>Escolha o tipo de relatório desejado</li>
          <li>Use os filtros de data quando disponíveis</li>
        </ol>
        
        <h4>Exportando Dados</h4>
        <ol>
          <li>Alguns relatórios permitem exportação</li>
          <li>Clique no botão de exportar para baixar os dados</li>
        </ol>
      `
    }
  ];

  const faqs = [
    {
      question: 'Por que não consigo ver alguns produtos?',
      answer: 'Os produtos são exibidos de acordo com seu nível de acesso. Vendedores veem apenas produtos liberados para vendas, gerentes veem mais produtos, e administradores têm acesso total. Se precisar de acesso a um produto específico, entre em contato com seu gestor.'
    },
    {
      question: 'Como altero minha senha?',
      answer: 'Acesse seu perfil clicando no seu nome no canto superior direito, depois em "Meu Perfil". Na seção de segurança você encontrará a opção para alterar sua senha.'
    },
    {
      question: 'Não estou recebendo notificações, o que fazer?',
      answer: 'Verifique se você está acessando a área de notificações regularmente. Se continuar sem receber, entre em contato com o suporte através de um ticket.'
    },
    {
      question: 'Como faço para baixar uma ficha técnica?',
      answer: 'Acesse o produto desejado e clique no botão "Ficha Técnica" ou vá em Materiais Comerciais para encontrar todos os arquivos disponíveis para download.'
    },
    {
      question: 'Posso acessar o portal pelo celular?',
      answer: 'Sim! O portal é totalmente responsivo e funciona em qualquer dispositivo. Basta acessar pelo navegador do seu celular ou tablet.'
    },
    {
      question: 'Minha conta foi desativada, o que fazer?',
      answer: 'Contas podem ser desativadas por administradores. Entre em contato com seu gestor ou com o suporte para verificar a situação.'
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <HelpCircle className="w-7 h-7 text-primary" />
              Central de Ajuda
            </h1>
            <p className="text-muted-foreground mt-1">
              Aprenda a usar todas as funcionalidades do portal
            </p>
          </div>
          <Button asChild>
            <Link to="/tickets">
              <TicketIcon className="w-4 h-4 mr-2" />
              Abrir Chamado
            </Link>
          </Button>
        </div>

        {/* Quick Help Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <Link to="/tickets/novo">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <MessageCircle className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Precisa de Suporte?</p>
                    <p className="text-sm text-muted-foreground">Abra um chamado</p>
                  </div>
                </div>
              </CardContent>
            </Link>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <Link to="/tickets">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-success/10">
                    <TicketIcon className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <p className="font-semibold">Meus Chamados</p>
                    <p className="text-sm text-muted-foreground">Acompanhe suas solicitações</p>
                  </div>
                </div>
              </CardContent>
            </Link>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-role-gerente/10">
                  <BookOpen className="w-6 h-6 text-role-gerente" />
                </div>
                <div>
                  <p className="font-semibold">Guias Completos</p>
                  <p className="text-sm text-muted-foreground">Veja abaixo</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Guides Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Guias de Uso
            </CardTitle>
            <CardDescription>
              Clique em cada tópico para ver instruções detalhadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {guides.map((guide, index) => {
                const Icon = guide.icon;
                return (
                  <AccordionItem key={index} value={`guide-${index}`}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium">{guide.title}</p>
                          <p className="text-sm text-muted-foreground">{guide.description}</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div 
                        className="prose prose-sm max-w-none text-foreground pl-11
                          [&_h4]:font-semibold [&_h4]:text-foreground [&_h4]:mt-4 [&_h4]:mb-2
                          [&_ol]:list-decimal [&_ol]:ml-4 [&_ol]:space-y-1
                          [&_ul]:list-disc [&_ul]:ml-4 [&_ul]:space-y-1
                          [&_li]:text-muted-foreground [&_li]:text-sm
                          [&_strong]:text-foreground [&_strong]:font-medium"
                        dangerouslySetInnerHTML={{ __html: guide.content }}
                      />
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              Perguntas Frequentes
            </CardTitle>
            <CardDescription>
              Respostas para as dúvidas mais comuns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`faq-${index}`}>
                  <AccordionTrigger className="text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* Contact Support */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <MessageCircle className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Não encontrou o que procurava?</p>
                  <p className="text-sm text-muted-foreground">
                    Nossa equipe está pronta para ajudar você
                  </p>
                </div>
              </div>
              <Button asChild>
                <Link to="/tickets/novo">
                  Abrir Chamado de Suporte
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Help;
